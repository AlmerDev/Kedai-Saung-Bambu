import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { extractMidtransPaymentDetail, mapMidtransStatus } from "@/lib/midtrans";

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

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid notification body." }, { status: 400 });

  const serverKey = process.env.MIDTRANS_SERVER_KEY || "";
  const signature = crypto
    .createHash("sha512")
    .update(`${body.order_id}${body.status_code}${body.gross_amount}${serverKey}`)
    .digest("hex");

  if (signature !== body.signature_key) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 403 });
  }

  const mapped = mapMidtransStatus(String(body.transaction_status || ""), body.fraud_status ? String(body.fraud_status) : undefined);

  const detail = extractMidtransPaymentDetail(body as Record<string, any>);

  const payload: Record<string, unknown> = {
    payment_status: mapped.payment_status,
    payment_type: detail.payment_type || "midtrans",
    payment_channel: detail.payment_channel,
    payment_reference: detail.payment_reference,
    midtrans_transaction_id: body.transaction_id || null
  };
  if (mapped.status) payload.status = mapped.status;

  const supabase = getSupabaseAdmin();
  let updateResult = await supabase.from("orders").update(payload).eq("midtrans_order_id", body.order_id);

  if (updateResult.error && isMissingPaymentColumn(updateResult.error)) {
    const fallbackPayload: Record<string, unknown> = { payment_status: mapped.payment_status };
    if (mapped.status) fallbackPayload.status = mapped.status;
    updateResult = await supabase.from("orders").update(fallbackPayload).eq("midtrans_order_id", body.order_id);
  }

  if (updateResult.error) return NextResponse.json({ error: updateResult.error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
