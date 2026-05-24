import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { mapMidtransStatus, midtransApiBaseUrl, midtransAuthHeader } from "@/lib/midtrans";

export const runtime = "nodejs";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) return NextResponse.json({ error: "MIDTRANS_SERVER_KEY belum diisi." }, { status: 500 });

  const supabase = getSupabaseAdmin();
  const { data: order, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .single();

  if (error || !order) return NextResponse.json({ error: error?.message || "Order tidak ditemukan." }, { status: 404 });

  if (order.payment_method !== "midtrans" || !order.midtrans_order_id) {
    return NextResponse.json({ order, synced: false, reason: "Order belum memakai pembayaran Midtrans." });
  }

  const response = await fetch(`${midtransApiBaseUrl()}/v2/${encodeURIComponent(order.midtrans_order_id)}/status`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: midtransAuthHeader(serverKey)
    },
    cache: "no-store"
  });

  const result = await response.json().catch(() => ({}));

  // Saat customer menutup popup sebelum memilih metode pembayaran, Midtrans bisa belum punya status transaksi.
  // Kondisi ini tetap dianggap "menunggu" supaya customer bisa membuka ulang Snap dari token yang sama.
  if (response.status === 404) {
    const { data: waitingOrder, error: waitingError } = await supabase
      .from("orders")
      .update({ payment_status: "menunggu" })
      .eq("id", id)
      .select("*, order_items(*)")
      .single();

    if (waitingError) return NextResponse.json({ error: waitingError.message }, { status: 500 });
    return NextResponse.json({ order: waitingOrder, synced: true, midtrans_status: "not_found_yet" });
  }

  if (!response.ok) {
    return NextResponse.json({ error: result.status_message || result.error_messages?.join(", ") || "Gagal mengambil status Midtrans." }, { status: 502 });
  }

  const mapped = mapMidtransStatus(String(result.transaction_status || ""), result.fraud_status ? String(result.fraud_status) : undefined);
  const payload: Record<string, unknown> = {
    payment_status: mapped.payment_status,
    midtrans_transaction_id: result.transaction_id || order.midtrans_transaction_id || null
  };
  if (mapped.status) payload.status = mapped.status;

  const { data: updatedOrder, error: updateError } = await supabase
    .from("orders")
    .update(payload)
    .eq("id", id)
    .select("*, order_items(*)")
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ order: updatedOrder, synced: true, midtrans_status: result.transaction_status });
}
