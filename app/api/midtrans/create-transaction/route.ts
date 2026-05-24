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

export async function POST(request: NextRequest) {
  const { orderId } = await request.json().catch(() => ({ orderId: "" }));
  if (!orderId) return NextResponse.json({ error: "orderId wajib diisi." }, { status: 400 });

  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  if (!serverKey) return NextResponse.json({ error: "MIDTRANS_SERVER_KEY belum diisi." }, { status: 500 });

  const supabase = getSupabaseAdmin();
  const { data: order, error } = await supabase.from("orders").select("*, order_items(*)").eq("id", orderId).single();
  if (error || !order) return NextResponse.json({ error: error?.message || "Order tidak ditemukan." }, { status: 404 });
  if (order.payment_method !== "midtrans") return NextResponse.json({ error: "Order ini bukan pembayaran Midtrans." }, { status: 400 });
  if (order.payment_status === "lunas") return NextResponse.json({ already_paid: true, order, error: "Order ini sudah lunas." }, { status: 409 });

  if (order.midtrans_snap_token && order.payment_status === "menunggu") {
    return NextResponse.json({
      token: order.midtrans_snap_token,
      redirect_url: order.midtrans_redirect_url,
      reused: true,
      order
    });
  }

  const midtransOrderId = makeMidtransOrderId(order.order_code, order.midtrans_order_id, order.payment_status);

  const transactionPayload = {
    transaction_details: {
      order_id: midtransOrderId,
      gross_amount: order.total
    },
    customer_details: {
      first_name: order.customer_name,
      phone: order.customer_phone || undefined
    },
    item_details: [
      ...order.order_items.map((item: any) => ({
        id: item.product_id || item.id,
        name: item.product_name.slice(0, 50),
        price: item.price,
        quantity: item.quantity
      })),
      ...(order.service_fee > 0
        ? [{ id: "service-fee", name: "Service Fee", price: order.service_fee, quantity: 1 }]
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
    body: JSON.stringify(transactionPayload)
  });

  const data = await response.json();
  if (!response.ok) {
    return NextResponse.json({ error: data.error_messages?.join(", ") || "Gagal membuat transaksi Midtrans." }, { status: 500 });
  }

  const { data: updatedOrder } = await supabase
    .from("orders")
    .update({
      midtrans_order_id: midtransOrderId,
      midtrans_snap_token: data.token,
      midtrans_redirect_url: data.redirect_url,
      payment_status: "menunggu",
      status: order.status === "dibatalkan" ? "baru" : order.status
    })
    .eq("id", order.id)
    .select("*, order_items(*)")
    .single();

  return NextResponse.json({ token: data.token, redirect_url: data.redirect_url, order: updatedOrder || order });
}
