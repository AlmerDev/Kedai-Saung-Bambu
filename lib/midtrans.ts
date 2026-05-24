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
