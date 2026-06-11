import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdmin();

    const { data: order, error: findError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (findError || !order) {
      return jsonError(findError?.message || "Order tidak ditemukan.", 404, findError);
    }

    if (order.status === "dibatalkan") {
      const { data: existing } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", id)
        .single();
      return NextResponse.json({ order: existing || order, message: "Order sudah dibatalkan." });
    }

    if (order.status === "selesai") {
      return jsonError("Pesanan sudah selesai, jadi tidak bisa dibatalkan dari halaman pelanggan.", 409);
    }

    if (["lunas", "refund"].includes(order.payment_status)) {
      return jsonError("Pembayaran sudah tercatat lunas/refund. Hubungi admin kedai kalau ingin membatalkan pesanan.", 409);
    }

    const nextPaymentStatus = order.payment_method === "midtrans" ? "gagal" : "belum_bayar";

    const { data: updated, error: updateError } = await supabase
      .from("orders")
      .update({
        status: "dibatalkan",
        payment_status: nextPaymentStatus,
        payment_reference: "Dibatalkan pelanggan sebelum pembayaran selesai"
      })
      .eq("id", id)
      .select("*, order_items(*)")
      .single();

    if (updateError || !updated) {
      return jsonError(updateError?.message || "Gagal membatalkan order.", 500, updateError);
    }

    await supabase.rpc("restore_order_stock", { p_order_id: id });
    const { data: restoredOrder } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", id)
      .single();

    return NextResponse.json({ order: restoredOrder || updated, message: "Pesanan berhasil dibatalkan." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server gagal membatalkan order.";
    return jsonError(message, 500);
  }
}
