import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { todayOrderCode } from "@/lib/format";

export const runtime = "nodejs";

type IncomingItem = { product_id: string; quantity: number; note?: string };

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

function getMessage(error: unknown) {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && "message" in error) return String((error as { message?: unknown }).message || "");
  return String(error);
}

function isMissingOptionalOrderColumn(error: unknown) {
  const lower = getMessage(error).toLowerCase();
  return (
    lower.includes("schema cache") &&
    (lower.includes("payment_type") || lower.includes("payment_channel") || lower.includes("payment_reference") || lower.includes("midtrans_snap_token") || lower.includes("midtrans_redirect_url"))
  );
}

function friendlySupabaseError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("row-level security")) {
    return "Order ditolak Supabase karena RLS. Pastikan SUPABASE_SERVICE_ROLE_KEY di .env.local/Vercel memakai service_role key, bukan anon/public key. Jalankan juga supabase/fix_checkout_orders.sql.";
  }

  if (lower.includes("payment_type") || lower.includes("payment_channel") || lower.includes("midtrans_snap_token") || lower.includes("midtrans_redirect_url")) {
    return "Database orders belum update kolom pembayaran. Jalankan supabase/fix_checkout_orders.sql di Supabase SQL Editor, lalu coba lagi.";
  }

  if (lower.includes("invalid api key") || lower.includes("jwt") || lower.includes("unauthorized")) {
    return "Key Supabase tidak valid. Cek NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di .env.local/Vercel ENV.";
  }

  return message;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return jsonError("Body tidak valid.", 400);

    const customerName = String(body.customer_name || "").trim();
    const customerPhone = String(body.customer_phone || "").trim();
    const tableNumber = String(body.table_number || "").trim();
    const note = String(body.note || "").trim();
    const paymentMethod = body.payment_method === "midtrans" ? "midtrans" : "cash";
    const items = Array.isArray(body.items) ? (body.items as IncomingItem[]) : [];

    if (!customerName) return jsonError("Nama pelanggan wajib diisi.", 400);
    if (!tableNumber) return jsonError("Nomor meja wajib diisi.", 400);
    if (items.length === 0) return jsonError("Keranjang masih kosong.", 400);

    const normalized = items
      .map((item) => ({
        product_id: String(item.product_id || ""),
        quantity: Math.max(1, Number(item.quantity || 1)),
        note: String(item.note || "").trim()
      }))
      .filter((item) => item.product_id);

    if (normalized.length === 0) return jsonError("Item pesanan tidak valid.", 400);

    const aggregated = Array.from(
      normalized.reduce((map, item) => {
        const existing = map.get(item.product_id);
        if (existing) existing.quantity += item.quantity;
        else map.set(item.product_id, { ...item });
        return map;
      }, new Map<string, { product_id: string; quantity: number; note: string }>()).values()
    );

    const productIds = [...new Set(aggregated.map((item) => item.product_id))];
    const supabase = getSupabaseAdmin();

    const { data: products, error: productError } = await supabase
      .from("products")
      .select("id, name, price, stock, is_available")
      .in("id", productIds)
      .eq("is_available", true);

    if (productError) return jsonError(friendlySupabaseError(productError.message), 500, productError);
    if (!products || products.length !== productIds.length) return jsonError("Ada menu yang tidak tersedia / sudah dihapus. Refresh halaman lalu pilih ulang menu.", 400);

    for (const item of aggregated) {
      const product = products.find((entry) => entry.id === item.product_id)!;
      const stock = Number(product.stock || 0);
      if (stock <= 0) return jsonError(`Stok ${product.name} sudah habis. Refresh halaman lalu pilih menu lain.`, 400);
      if (item.quantity > stock) return jsonError(`Stok ${product.name} tinggal ${stock}. Kurangi jumlah pesanan.`, 400);
    }

    const { data: settings, error: settingsError } = await supabase
      .from("store_settings")
      .select("service_fee_percent")
      .eq("id", 1)
      .maybeSingle();

    if (settingsError) return jsonError(friendlySupabaseError(settingsError.message), 500, settingsError);

    const itemRows = aggregated.map((item) => {
      const product = products.find((entry) => entry.id === item.product_id)!;
      const subtotal = Number(product.price) * item.quantity;
      return {
        product_id: product.id,
        product_name: product.name,
        price: Number(product.price),
        quantity: item.quantity,
        subtotal,
        note: item.note || null
      };
    });

    const subtotal = itemRows.reduce((sum, item) => sum + item.subtotal, 0);
    const serviceFee = Math.round((subtotal * Number(settings?.service_fee_percent || 0)) / 100);
    const total = subtotal + serviceFee;

    const baseOrderPayload = {
      order_code: todayOrderCode(),
      table_number: tableNumber,
      customer_name: customerName,
      customer_phone: customerPhone || null,
      note: note || null,
      subtotal,
      service_fee: serviceFee,
      total,
      status: "baru",
      payment_status: paymentMethod === "midtrans" ? "menunggu" : "belum_bayar",
      payment_method: paymentMethod
    };

    const fullOrderPayload = {
      ...baseOrderPayload,
      payment_type: paymentMethod === "cash" ? "cash" : "midtrans",
      payment_channel: paymentMethod === "cash" ? "cash" : null
    };

    let insertResult = await supabase.from("orders").insert(fullOrderPayload).select("*").single();

    // Biar checkout tetap jalan walaupun database lama belum punya kolom payment_type/payment_channel.
    if (insertResult.error && isMissingOptionalOrderColumn(insertResult.error)) {
      insertResult = await supabase.from("orders").insert(baseOrderPayload).select("*").single();
    }

    if (insertResult.error || !insertResult.data) {
      return jsonError(friendlySupabaseError(insertResult.error?.message || "Gagal membuat order di Supabase."), 500, insertResult.error);
    }

    const order = insertResult.data;

    const { data: orderItems, error: itemError } = await supabase
      .from("order_items")
      .insert(itemRows.map((item) => ({ ...item, order_id: order.id })))
      .select("*");

    if (itemError) {
      await supabase.from("orders").delete().eq("id", order.id);
      return jsonError(friendlySupabaseError(itemError.message), 500, itemError);
    }

    const decremented: Array<{ product_id: string; quantity: number }> = [];
    for (const item of itemRows) {
      const { data: stockOk, error: stockError } = await supabase.rpc("decrement_product_stock", {
        p_product_id: item.product_id,
        p_quantity: item.quantity
      });

      if (stockError || !stockOk) {
        for (const prev of decremented) {
          await supabase.rpc("increase_product_stock", {
            p_product_id: prev.product_id,
            p_quantity: prev.quantity
          });
        }
        await supabase.from("orders").delete().eq("id", order.id);
        return jsonError(stockError?.message || `Stok ${item.product_name} tidak cukup. Refresh halaman lalu pilih ulang menu.`, 409, stockError);
      }
      decremented.push({ product_id: item.product_id, quantity: item.quantity });
    }

    return NextResponse.json({ order: { ...order, order_items: orderItems || [] } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server gagal membuat order.";
    return jsonError(friendlySupabaseError(message), 500);
  }
}
