import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { todayOrderCode } from "@/lib/format";

export const runtime = "nodejs";

type IncomingItem = { product_id: string; quantity: number; note?: string };

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });

  const customerName = String(body.customer_name || "").trim();
  const customerPhone = String(body.customer_phone || "").trim();
  const tableNumber = String(body.table_number || "").trim();
  const note = String(body.note || "").trim();
  const paymentMethod = body.payment_method === "midtrans" ? "midtrans" : "cash";
  const items = Array.isArray(body.items) ? (body.items as IncomingItem[]) : [];

  if (!customerName) return NextResponse.json({ error: "Nama pelanggan wajib diisi." }, { status: 400 });
  if (!tableNumber) return NextResponse.json({ error: "Nomor meja wajib diisi." }, { status: 400 });
  if (items.length === 0) return NextResponse.json({ error: "Keranjang masih kosong." }, { status: 400 });

  const normalized = items
    .map((item) => ({ product_id: String(item.product_id || ""), quantity: Math.max(1, Number(item.quantity || 1)), note: String(item.note || "").trim() }))
    .filter((item) => item.product_id);

  const productIds = [...new Set(normalized.map((item) => item.product_id))];
  const supabase = getSupabaseAdmin();

  const { data: products, error: productError } = await supabase
    .from("products")
    .select("id, name, price, is_available")
    .in("id", productIds)
    .eq("is_available", true);

  if (productError) return NextResponse.json({ error: productError.message }, { status: 500 });
  if (!products || products.length !== productIds.length) return NextResponse.json({ error: "Ada menu yang tidak tersedia." }, { status: 400 });

  const { data: settings } = await supabase.from("store_settings").select("service_fee_percent").eq("id", 1).single();
  const itemRows = normalized.map((item) => {
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

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
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
    })
    .select("*")
    .single();

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });

  const { data: orderItems, error: itemError } = await supabase
    .from("order_items")
    .insert(itemRows.map((item) => ({ ...item, order_id: order.id })))
    .select("*");

  if (itemError) {
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: itemError.message }, { status: 500 });
  }

  return NextResponse.json({ order: { ...order, order_items: orderItems || [] } }, { status: 201 });
}
