import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { extractMidtransPaymentDetail, mapMidtransStatus, midtransApiBaseUrl, midtransAuthHeader } from "@/lib/midtrans";

export const runtime = "nodejs";

function errorMessage(error: unknown) {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && "message" in error) return String((error as { message?: unknown }).message || "");
  return String(error);
}

function isMissingPaymentColumn(error: unknown) {
  const lower = errorMessage(error).toLowerCase();
  return lower.includes("schema cache") && (lower.includes("payment_type") || lower.includes("payment_channel") || lower.includes("payment_reference") || lower.includes("midtrans_transaction_id"));
}

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
  const detail = extractMidtransPaymentDetail(result as Record<string, any>);

  const payload: Record<string, unknown> = {
    payment_status: mapped.payment_status,
    payment_type: detail.payment_type || "midtrans",
    payment_channel: detail.payment_channel,
    payment_reference: detail.payment_reference,
    midtrans_transaction_id: result.transaction_id || order.midtrans_transaction_id || null
  };
  if (mapped.status) payload.status = mapped.status;

  let updateResult = await supabase
    .from("orders")
    .update(payload)
    .eq("id", id)
    .select("*, order_items(*)")
    .single();

  if (updateResult.error && isMissingPaymentColumn(updateResult.error)) {
    const fallbackPayload: Record<string, unknown> = { payment_status: mapped.payment_status };
    if (mapped.status) fallbackPayload.status = mapped.status;

    updateResult = await supabase
      .from("orders")
      .update(fallbackPayload)
      .eq("id", id)
      .select("*, order_items(*)")
      .single();
  }

  if (updateResult.error) return NextResponse.json({ error: updateResult.error.message }, { status: 500 });

  return NextResponse.json({ order: updateResult.data, synced: true, midtrans_status: result.transaction_status });
}
