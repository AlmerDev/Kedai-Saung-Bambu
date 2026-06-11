import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest, unauthorized } from "@/lib/session";

export const runtime = "nodejs";

const ORDER_STATUS = ["baru", "diproses", "siap", "selesai", "dibatalkan"];
const PAYMENT_STATUS = ["belum_bayar", "menunggu", "lunas", "gagal", "expire", "refund"];

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return unauthorized();
  const { id } = await context.params;
  const body = await request.json();
  const payload: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!ORDER_STATUS.includes(body.status)) return NextResponse.json({ error: "Status order tidak valid." }, { status: 400 });
    payload.status = body.status;
  }

  if (body.payment_status !== undefined) {
    if (!PAYMENT_STATUS.includes(body.payment_status)) return NextResponse.json({ error: "Status pembayaran tidak valid." }, { status: 400 });
    payload.payment_status = body.payment_status;

    // Sinkron otomatis: kalau pembayaran dibuat lunas, pesanan masuk proses.
    // Kalau pembayaran gagal/expire, pesanan dibatalkan kecuali admin mengirim status khusus.
    if (body.status === undefined && body.payment_status === "lunas") payload.status = "diproses";
    if (body.status === undefined && ["gagal", "expire"].includes(body.payment_status)) payload.status = "dibatalkan";
  }

  if (body.note !== undefined) payload.note = body.note || null;

  const supabase = getSupabaseAdmin();
  let { data, error } = await supabase.from("orders").update(payload).eq("id", id).select("*, order_items(*)").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (data?.status === "dibatalkan" && !data.stock_restored) {
    await supabase.rpc("restore_order_stock", { p_order_id: id });
    const refreshed = await supabase.from("orders").select("*, order_items(*)").eq("id", id).single();
    data = refreshed.data || data;
  }

  return NextResponse.json({ order: data });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return unauthorized();
  const { id } = await context.params;
  const supabase = getSupabaseAdmin();
  const { data: order } = await supabase.from("orders").select("id, stock_restored").eq("id", id).maybeSingle();
  if (order && !order.stock_restored) await supabase.rpc("restore_order_stock", { p_order_id: id });
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
