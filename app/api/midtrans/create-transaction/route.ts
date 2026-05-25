import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { midtransAuthHeader, midtransSnapBaseUrl } from "@/lib/midtrans";

export const runtime = "nodejs";

function makeMidtransOrderId(orderCode: string, existingOrderId?: string | null, paymentStatus?: string) {
  // Order ID Midtrans harus unik. Kalau transaksi lama gagal/expire dan perlu dibuat ulang,
  // pakai suffix waktu agar tidak bentrok dengan order_id sebelumnya.
  if (existingOrderId && ["gagal", "expire", "refund"].includes(paymentStatus || "")) {
    return `${orderCode}-${Date.now().toString(36)}`;
  }
  return existingOrderId || orderCode;
}

async function readJsonSafely(response: Response) {
  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw_response: text };
  }
}

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

function errorMessage(error: unknown) {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && "message" in error) return String((error as { message?: unknown }).message || "");
  return String(error);
}

function isMissingPaymentColumn(error: unknown) {
  const lower = errorMessage(error).toLowerCase();
  return lower.includes("schema cache") && (lower.includes("midtrans_snap_token") || lower.includes("midtrans_redirect_url") || lower.includes("payment_type") || lower.includes("payment_channel") || lower.includes("payment_reference"));
}

export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json().catch(() => ({ orderId: "" }));
    if (!orderId) return jsonError("orderId wajib diisi.", 400);

    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
    if (!serverKey) return jsonError("MIDTRANS_SERVER_KEY belum diisi.", 500);

    const supabase = getSupabaseAdmin();
    const { data: order, error } = await supabase.from("orders").select("*, order_items(*)").eq("id", orderId).single();
    if (error || !order) return jsonError(error?.message || "Order tidak ditemukan.", 404);
    if (order.payment_method !== "midtrans") return jsonError("Order ini bukan pembayaran Midtrans.", 400);
    if (order.payment_status === "lunas") return NextResponse.json({ already_paid: true, order, error: "Order ini sudah lunas." }, { status: 409 });

    if (order.midtrans_snap_token && order.midtrans_redirect_url && order.payment_status === "menunggu") {
      return NextResponse.json({
        token: order.midtrans_snap_token,
        redirect_url: order.midtrans_redirect_url,
        reused: true,
        order
      });
    }

    const total = Number(order.total || 0);
    if (!Number.isFinite(total) || total <= 0) return jsonError("Total pembayaran tidak valid.", 400);

    const items = Array.isArray(order.order_items) ? order.order_items : [];
    const midtransOrderId = makeMidtransOrderId(order.order_code, order.midtrans_order_id, order.payment_status);

    const transactionPayload = {
      transaction_details: {
        order_id: midtransOrderId,
        gross_amount: total
      },
      customer_details: {
        first_name: order.customer_name,
        phone: order.customer_phone || undefined
      },
      item_details: [
        ...items.map((item: any) => ({
          id: String(item.product_id || item.id).slice(0, 50),
          name: String(item.product_name || "Menu").slice(0, 50),
          price: Number(item.price || 0),
          quantity: Number(item.quantity || 1)
        })),
        ...(Number(order.service_fee || 0) > 0
          ? [{ id: "service-fee", name: "Service Fee", price: Number(order.service_fee || 0), quantity: 1 }]
          : [])
      ],
      callbacks: {
        finish: `${siteUrl}/?order=${order.id}`
      },
      custom_field1: `Meja ${order.table_number || "-"}`
    };

    const response = await fetch(`${midtransSnapBaseUrl()}/snap/v1/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: midtransAuthHeader(serverKey)
      },
      body: JSON.stringify(transactionPayload),
      cache: "no-store"
    });

    const data = await readJsonSafely(response);

    if (!response.ok) {
      const message =
        data?.error_messages?.join(", ") ||
        data?.status_message ||
        data?.message ||
        data?.raw_response ||
        `Gagal membuat transaksi Midtrans. Status: ${response.status}`;

      return jsonError(message, 502, data);
    }

    const token = data?.token ? String(data.token) : "";
    const redirectUrl = data?.redirect_url ? String(data.redirect_url) : "";

    if (!token && !redirectUrl) {
      return jsonError("Midtrans tidak mengembalikan token pembayaran. Cek Server Key dan mode Sandbox/Production.", 502, data);
    }

    let updateResult = await supabase
      .from("orders")
      .update({
        midtrans_order_id: midtransOrderId,
        midtrans_snap_token: token || null,
        midtrans_redirect_url: redirectUrl || null,
        payment_status: "menunggu",
        status: order.status === "dibatalkan" ? "baru" : order.status
      })
      .eq("id", order.id)
      .select("*, order_items(*)")
      .single();

    // Database lama mungkin belum punya kolom snap_token/redirect_url. Pembayaran tetap bisa dibuka,
    // tapi fitur Bayar Lagi paling stabil kalau supabase/fix_checkout_orders.sql sudah dijalankan.
    if (updateResult.error && isMissingPaymentColumn(updateResult.error)) {
      updateResult = await supabase
        .from("orders")
        .update({
          midtrans_order_id: midtransOrderId,
          payment_status: "menunggu",
          status: order.status === "dibatalkan" ? "baru" : order.status
        })
        .eq("id", order.id)
        .select("*, order_items(*)")
        .single();
    }

    if (updateResult.error) return jsonError(updateResult.error.message, 500);

    return NextResponse.json({ token, redirect_url: redirectUrl, order: updateResult.data || order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server gagal memproses pembayaran.";
    return jsonError(message, 500);
  }
}
