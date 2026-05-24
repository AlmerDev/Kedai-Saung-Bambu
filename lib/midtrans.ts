export type MappedPaymentStatus = "belum_bayar" | "menunggu" | "lunas" | "gagal" | "expire" | "refund";
export type MappedOrderStatus = "baru" | "diproses" | "siap" | "selesai" | "dibatalkan";

export function midtransSnapBaseUrl() {
  return process.env.MIDTRANS_IS_PRODUCTION === "true" ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com";
}

export function midtransApiBaseUrl() {
  return process.env.MIDTRANS_IS_PRODUCTION === "true" ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";
}

export function midtransAuthHeader(serverKey: string) {
  return `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`;
}

export function mapMidtransStatus(transactionStatus: string, fraudStatus?: string): {
  payment_status: MappedPaymentStatus;
  status?: MappedOrderStatus;
} {
  if (transactionStatus === "capture") {
    if (!fraudStatus || fraudStatus === "accept") return { payment_status: "lunas", status: "diproses" };
    return { payment_status: "menunggu" };
  }

  if (transactionStatus === "settlement") return { payment_status: "lunas", status: "diproses" };
  if (transactionStatus === "pending") return { payment_status: "menunggu" };
  if (["deny", "cancel", "failure"].includes(transactionStatus)) return { payment_status: "gagal", status: "dibatalkan" };
  if (transactionStatus === "expire") return { payment_status: "expire", status: "dibatalkan" };
  if (["refund", "partial_refund"].includes(transactionStatus)) return { payment_status: "refund", status: "dibatalkan" };

  return { payment_status: "menunggu" };
}


export function normalizePaymentType(paymentType?: string | null) {
  const value = String(paymentType || "").trim().toLowerCase();
  if (!value) return null;
  return value;
}

export function extractMidtransPaymentDetail(result: Record<string, any>) {
  const paymentType = normalizePaymentType(result.payment_type);

  let channel: string | null = null;
  let reference: string | null = null;

  if (paymentType === "bank_transfer") {
    const va = Array.isArray(result.va_numbers) ? result.va_numbers[0] : null;
    channel = va?.bank || result.bank || null;
    reference = va?.va_number || result.permata_va_number || result.bill_key || null;
  } else if (paymentType === "echannel") {
    channel = "mandiri";
    reference = result.bill_key || null;
  } else if (paymentType === "qris") {
    channel = result.acquirer || result.issuer || "qris";
    reference = result.transaction_id || null;
  } else if (["gopay", "shopeepay", "dana", "linkaja"].includes(paymentType || "")) {
    channel = paymentType;
    reference = result.transaction_id || null;
  } else if (paymentType === "cstore") {
    channel = result.store || "cstore";
    reference = result.payment_code || null;
  } else if (paymentType === "credit_card") {
    channel = result.bank || result.card_type || "credit_card";
    reference = result.masked_card || result.transaction_id || null;
  }

  return {
    payment_type: paymentType,
    payment_channel: channel,
    payment_reference: reference
  };
}
