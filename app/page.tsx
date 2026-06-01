"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import { CartItem, Category, DiningTable, Order, Product, StoreSettings } from "@/lib/types";
import { rupiah } from "@/lib/format";

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        callbacks?: {
          onSuccess?: (result: unknown) => void;
          onPending?: (result: unknown) => void;
          onError?: (result: unknown) => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

type MenuResponse = {
  settings: StoreSettings | null;
  categories: Category[];
  products: Product[];
  tables: DiningTable[];
};

type Toast = {
  id: number;
  type: "success" | "error" | "info";
  title: string;
  description?: string;
};

type PaymentDialog = {
  type: "processing" | "success" | "pending" | "error" | "closed" | "cash";
  title: string;
  description: string;
  order?: Order | null;
  canRetry?: boolean;
  redirectUrl?: string | null;
};

type ViewMode = "menu" | "cart";

type ConfirmDialog = {
  type: "reset-cart" | "cancel-order" | "cancel-and-reselect";
  title: string;
  description: string;
  order?: Order | null;
};

const midtransClientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || "";
const snapUrl = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true" ? "https://app.midtrans.com/snap/snap.js" : "https://app.sandbox.midtrans.com/snap/snap.js";

function categoryIconClass(name?: string | null) {
  const value = (name || "").toLowerCase();
  if (value.includes("ayam")) return "fa-solid fa-drumstick-bite";
  if (value.includes("minum") || value.includes("kopi") || value.includes("teh")) return "fa-solid fa-mug-saucer";
  if (value.includes("ringan") || value.includes("cemilan") || value.includes("snack")) return "fa-solid fa-cookie-bite";
  if (value.includes("nasi") || value.includes("paket")) return "fa-solid fa-bowl-food";
  return "fa-solid fa-utensils";
}

function CategoryIcon({ name }: { name?: string | null }) {
  return <i className={categoryIconClass(name)} aria-hidden="true" />;
}

export default function HomePage() {
  const [data, setData] = useState<MenuResponse>({ settings: null, categories: [], products: [], tables: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("semua");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableNumber, setTableNumber] = useState("1");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [paymentDialog, setPaymentDialog] = useState<PaymentDialog | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const [cancelingOrder, setCancelingOrder] = useState(false);
  const [view, setView] = useState<ViewMode>("menu");
  const paymentSummaryRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const table = params.get("meja") || params.get("table");
    if (table) setTableNumber(table);

    const returnedOrderId = params.get("order");
    if (returnedOrderId) loadReturnedOrder(returnedOrderId);

    fetch("/api/public/menu")
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || "Gagal memuat menu.");
        setData(payload);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat menu."))
      .finally(() => setLoading(false));
  }, []);

  function notify(type: Toast["type"], title: string, description?: string) {
    const id = Date.now();
    setToasts((current) => [...current, { id, type, title, description }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4200);
  }

  function getErrorMessage(err: unknown, fallback: string) {
    return err instanceof Error ? err.message : fallback;
  }

  function goToCart() {
    if (cart.length === 0) {
      notify("info", "Keranjang masih kosong", "Pilih menu dulu, nanti checkout muncul di halaman terpisah.");
      return;
    }
    setView("cart");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function backToMenu() {
    setView("menu");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function scrollToPaymentSummary() {
    setView("cart");
    window.setTimeout(() => {
      paymentSummaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function resetCart() {
    setCart([]);
    setOrderNote("");
    setCustomerPhone("");
    setConfirmDialog(null);
    setView("menu");
    notify("info", "Keranjang dikosongkan", "Silakan pilih ulang menu yang benar.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function askResetCart() {
    if (cart.length === 0) {
      backToMenu();
      return;
    }
    setConfirmDialog({
      type: "reset-cart",
      title: "Batalkan keranjang?",
      description: "Semua menu dan catatan yang sudah dipilih akan dihapus. Setelah itu kamu bisa pilih ulang dari awal."
    });
  }

  function keepCartAndPickMore() {
    notify("info", "Silakan pilih ulang", "Keranjang kamu tetap tersimpan. Ubah jumlah atau tambah menu yang benar.");
    backToMenu();
  }

  const settings = data.settings || {
    store_name: "KEDAI SAUNG BAMBU",
    tagline: "Ayam bakar, ayam goreng, minuman segar, dan cemilan ala saung.",
    address: "Indonesia",
    whatsapp: "",
    service_fee_percent: 0,
    opening_hours: "Setiap hari 09.00 - 22.00",
    hero_image_url: null,
    logo_url: null,
    id: 1
  };

  const categories = useMemo(() => [{ id: "semua", name: "Semua", emoji: null, slug: "semua", sort_order: 0, is_active: true }, ...data.categories], [data.categories]);
  const products = useMemo(() => data.products.filter((item) => category === "semua" || item.category_id === category), [category, data.products]);

  const featuredProducts = useMemo(() => data.products.slice(0, 3), [data.products]);

  const productsByCategory = useMemo(() => {
    const groups = data.categories
      .map((cat) => ({ category: cat, products: data.products.filter((product) => product.category_id === cat.id) }))
      .filter((group) => group.products.length > 0);

    const uncategorized = data.products.filter((product) => !product.category_id);
    if (uncategorized.length > 0) {
      groups.push({
        category: { id: "lainnya", name: "Lainnya", slug: "lainnya", emoji: null, sort_order: 999, is_active: true },
        products: uncategorized
      });
    }

    return groups;
  }, [data.categories, data.products]);

  const cartLines = useMemo(() => {
    return cart
      .map((item) => {
        const product = data.products.find((menu) => menu.id === item.product_id);
        if (!product) return null;
        return { ...item, product, subtotal: product.price * item.quantity };
      })
      .filter(Boolean) as Array<CartItem & { product: Product; subtotal: number }>;
  }, [cart, data.products]);

  const subtotal = cartLines.reduce((sum, item) => sum + item.subtotal, 0);
  const serviceFee = Math.round((subtotal * Number(settings.service_fee_percent || 0)) / 100);
  const total = subtotal + serviceFee;
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);


  async function readApiJson(response: Response) {
    const text = await response.text();
    if (!text.trim()) return {};

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Response server kosong/tidak valid JSON. Status ${response.status}. Cek terminal lokal atau Vercel Function Logs.`);
    }
  }

  function addToCart(productId: string) {
    setCart((current) => {
      const exist = current.find((item) => item.product_id === productId);
      if (exist) return current.map((item) => (item.product_id === productId ? { ...item, quantity: item.quantity + 1 } : item));
      return [...current, { product_id: productId, quantity: 1 }];
    });
    notify("success", "Menu masuk keranjang", "Buka checkout dari tombol keranjang di atas/bawah.");
  }

  function changeQty(productId: string, qty: number) {
    setCart((current) => {
      if (qty <= 0) return current.filter((item) => item.product_id !== productId);
      return current.map((item) => (item.product_id === productId ? { ...item, quantity: qty } : item));
    });
  }

  function updateNote(productId: string, note: string) {
    setCart((current) => current.map((item) => (item.product_id === productId ? { ...item, note } : item)));
  }

  async function createOrder(paymentMethod: "cash" | "midtrans") {
    if (cart.length === 0) throw new Error("Keranjang masih kosong. Pilih menu dulu ya.");
    if (!customerName.trim()) throw new Error("Isi nama pelanggan dulu.");
    if (!tableNumber.trim()) throw new Error("Nomor meja wajib diisi.");

    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table_number: tableNumber,
        customer_name: customerName,
        customer_phone: customerPhone,
        note: orderNote,
        payment_method: paymentMethod,
        items: cart.map((item) => ({ product_id: item.product_id, quantity: item.quantity, note: item.note || "" }))
      })
    });
    const payload = await readApiJson(response) as any;
    if (!response.ok) throw new Error(payload.error || "Gagal membuat order.");
    return payload.order as Order;
  }

  function finishOrder(order: Order) {
    setLastOrder(order);
    setCart([]);
    setOrderNote("");
    setView("menu");
  }

  async function handleCash() {
    try {
      setSubmitting(true);
      setPaymentDialog({ type: "processing", title: "Mengirim pesanan...", description: "Sebentar ya, pesanan sedang dikirim ke admin dapur." });
      const order = await createOrder("cash");
      finishOrder(order);
      setPaymentDialog({
        type: "cash",
        title: "Pesanan terkirim ke kasir",
        description: "Sebutkan kode pesanan ini saat membayar di kasir. Admin sudah bisa melihat pesanan kamu.",
        order
      });
      notify("success", "Pesanan berhasil dibuat", `Kode pesanan #${order.order_code}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const message = getErrorMessage(err, "Gagal membuat order.");
      setPaymentDialog({ type: "error", title: "Pesanan belum bisa dikirim", description: message });
      notify("error", "Gagal membuat order", message);
    } finally {
      setSubmitting(false);
    }
  }

  function canRetryPayment(order: Order | null | undefined) {
    if (!order) return false;
    return order.payment_method === "midtrans" && !["lunas", "refund"].includes(order.payment_status) && order.status !== "selesai" && order.status !== "dibatalkan";
  }

  function canCancelOrder(order: Order | null | undefined) {
    if (!order) return false;
    return !["lunas", "refund"].includes(order.payment_status) && !["selesai", "dibatalkan"].includes(order.status);
  }

  function paymentTitle(order: Order) {
    if (order.payment_status === "lunas") return "Pembayaran berhasil";
    if (order.payment_status === "gagal") return "Pembayaran gagal";
    if (order.payment_status === "expire") return "Pembayaran kedaluwarsa";
    if (order.status === "dibatalkan") return "Pesanan dibatalkan";
    if (order.payment_status === "refund") return "Pembayaran refund";
    return "Pembayaran menunggu";
  }

  function paymentDescription(order: Order) {
    if (order.payment_status === "lunas") return "Status order otomatis berubah menjadi lunas dan pesanan masuk ke dapur untuk diproses.";
    if (order.payment_status === "gagal") return "Transaksi belum berhasil. Kamu bisa membuka ulang pembayaran atau bayar langsung di kasir.";
    if (order.payment_status === "expire") return "Waktu pembayaran sudah habis. Kamu bisa membuka ulang pembayaran dari tombol Bayar Lagi.";
    if (order.status === "dibatalkan") return "Pesanan ini sudah dibatalkan. Kamu bisa kembali ke menu dan membuat pesanan baru.";
    if (order.payment_status === "refund") return "Transaksi tercatat refund. Hubungi admin kedai untuk pengecekan.";
    return "Pesanan sudah tersimpan. Selesaikan pembayaran dari popup Midtrans atau klik Bayar Lagi kalau popup tertutup.";
  }

  async function fetchOrder(orderId: string) {
    const response = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
    const payload = await readApiJson(response) as any;
    if (!response.ok) throw new Error(payload.error || "Gagal mengambil detail order.");
    return payload.order as Order;
  }

  async function syncPayment(orderId: string) {
    const response = await fetch(`/api/orders/${orderId}/sync-payment`, { method: "POST" });
    const payload = await readApiJson(response) as any;
    if (!response.ok) throw new Error(payload.error || "Gagal mengecek status pembayaran.");
    return payload.order as Order;
  }

  async function cancelOrder(order: Order, goReselect = false) {
    try {
      setCancelingOrder(true);
      setSubmitting(true);
      setPaymentDialog({
        type: "processing",
        title: "Membatalkan pesanan",
        description: "Sebentar ya, pesanan sedang dibatalkan supaya tidak masuk proses dapur.",
        order
      });

      const response = await fetch(`/api/orders/${order.id}/cancel`, { method: "POST" });
      const payload = await readApiJson(response) as any;
      if (!response.ok) throw new Error(payload.error || "Gagal membatalkan pesanan.");

      const canceledOrder = payload.order as Order;
      setLastOrder(canceledOrder);
      setConfirmDialog(null);
      setCart([]);
      setOrderNote("");
      setPaymentDialog({
        type: "closed",
        title: "Pesanan dibatalkan",
        description: goReselect ? "Pesanan lama sudah dibatalkan. Silakan pilih ulang menu yang benar." : "Pesanan sudah dibatalkan dan tidak akan diproses dapur.",
        order: canceledOrder,
        canRetry: false
      });
      notify("success", "Pesanan dibatalkan", goReselect ? "Sekarang kamu bisa pilih ulang menu." : "Order lama tidak akan diproses.");

      if (goReselect) {
        setPaymentDialog(null);
        setView("menu");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      const message = getErrorMessage(err, "Gagal membatalkan pesanan.");
      setPaymentDialog({ type: "error", title: "Pesanan belum bisa dibatalkan", description: message, order, canRetry: canRetryPayment(order) });
      notify("error", "Gagal membatalkan pesanan", message);
    } finally {
      setCancelingOrder(false);
      setSubmitting(false);
    }
  }

  function askCancelOrder(order: Order, goReselect = false) {
    if (!canCancelOrder(order)) {
      notify("error", "Tidak bisa dibatalkan", "Pesanan yang sudah lunas/selesai harus dibatalkan lewat admin kedai.");
      return;
    }
    setConfirmDialog({
      type: goReselect ? "cancel-and-reselect" : "cancel-order",
      title: goReselect ? "Batalkan dan pilih ulang menu?" : "Batalkan pesanan ini?",
      description: goReselect
        ? "Pesanan lama akan dibatalkan dulu supaya tidak diproses dapur. Setelah itu kamu bisa mulai pilih menu dari awal."
        : "Pesanan ini akan ditandai dibatalkan di admin dan tidak masuk proses dapur.",
      order
    });
  }

  async function getLatestMidtransOrder(orderId: string) {
    try {
      return await syncPayment(orderId);
    } catch {
      return await fetchOrder(orderId);
    }
  }

  async function loadReturnedOrder(orderId: string) {
    try {
      setPaymentDialog({ type: "processing", title: "Mengecek pembayaran", description: "Sebentar ya, status pembayaran sedang dicocokkan dengan Midtrans." });
      const order = await getLatestMidtransOrder(orderId);
      setLastOrder(order);
      setCart([]);
      setView("menu");
      setPaymentDialog({
        type: order.payment_status === "lunas" ? "success" : order.payment_status === "gagal" || order.payment_status === "expire" ? "error" : "pending",
        title: paymentTitle(order),
        description: paymentDescription(order),
        order,
        canRetry: canRetryPayment(order)
      });
    } catch (err) {
      const message = getErrorMessage(err, "Gagal mengecek status pembayaran.");
      setPaymentDialog({ type: "error", title: "Status belum bisa dicek", description: message });
    }
  }

  async function prepareMidtrans(orderId: string) {
    const response = await fetch("/api/midtrans/create-transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId })
    });
    const payload = await readApiJson(response) as any;
    const token = payload.token ? String(payload.token) : "";
    const redirectUrl = payload.redirect_url ? String(payload.redirect_url) : "";
    if (!response.ok || (!token && !redirectUrl)) throw new Error(payload.error || "Gagal membuat transaksi Midtrans.");
    return { token, redirectUrl, order: (payload.order || null) as Order | null };
  }

  function openRedirectPayment(redirectUrl: string) {
    window.location.href = redirectUrl;
  }

  function openSnapPayment(order: Order, token: string, redirectUrl?: string | null) {
    setPaymentDialog({
      type: "processing",
      title: "Membuka pembayaran Midtrans",
      description: "Pilih QRIS, e-wallet, atau metode lain. Kalau popup tidak muncul, klik tombol Buka Halaman Pembayaran.",
      order,
      canRetry: true,
      redirectUrl
    });
    notify("info", "Pembayaran disiapkan", "Kalau popup Midtrans tidak muncul, gunakan tombol Buka Halaman Pembayaran.");

    if (!window.snap || !token) {
      if (redirectUrl) {
        notify("info", "Membuka halaman pembayaran", "Popup belum siap, jadi pembayaran dibuka lewat halaman Midtrans.");
        openRedirectPayment(redirectUrl);
        return;
      }
      throw new Error("Snap Midtrans belum siap. Coba klik Bayar Lagi beberapa detik lagi.");
    }

    try {
      window.snap.pay(token, {
      onSuccess: async () => {
        const syncedOrder = await getLatestMidtransOrder(order.id);
        finishOrder(syncedOrder);
        setPaymentDialog({
          type: syncedOrder.payment_status === "lunas" ? "success" : "pending",
          title: paymentTitle(syncedOrder),
          description: paymentDescription(syncedOrder),
          order: syncedOrder,
          canRetry: canRetryPayment(syncedOrder),
          redirectUrl: syncedOrder.midtrans_redirect_url
        });
        notify(syncedOrder.payment_status === "lunas" ? "success" : "info", paymentTitle(syncedOrder), paymentDescription(syncedOrder));
      },
      onPending: async () => {
        const syncedOrder = await getLatestMidtransOrder(order.id);
        finishOrder(syncedOrder);
        setPaymentDialog({
          type: "pending",
          title: paymentTitle(syncedOrder),
          description: paymentDescription(syncedOrder),
          order: syncedOrder,
          canRetry: canRetryPayment(syncedOrder),
          redirectUrl: syncedOrder.midtrans_redirect_url
        });
        notify("info", "Menunggu pembayaran", "Pesanan tersimpan. Kamu bisa melanjutkan pembayaran lagi kalau popup tertutup.");
      },
      onError: async () => {
        const syncedOrder = await getLatestMidtransOrder(order.id);
        finishOrder(syncedOrder);
        setPaymentDialog({
          type: "error",
          title: paymentTitle(syncedOrder),
          description: paymentDescription(syncedOrder),
          order: syncedOrder,
          canRetry: canRetryPayment(syncedOrder),
          redirectUrl: syncedOrder.midtrans_redirect_url
        });
        notify("error", "Pembayaran belum berhasil", "Silakan klik Bayar Lagi atau bayar di kasir.");
      },
      onClose: async () => {
        const syncedOrder = await getLatestMidtransOrder(order.id);
        finishOrder(syncedOrder);
        setPaymentDialog({
          type: "closed",
          title: "Pembayaran ditutup",
          description: "Popup Midtrans tertutup sebelum pembayaran selesai. Pesanan tetap tersimpan, dan kamu bisa mengulang pembayaran dari tombol Bayar Lagi.",
          order: syncedOrder,
          canRetry: canRetryPayment(syncedOrder),
          redirectUrl: syncedOrder.midtrans_redirect_url
        });
        notify("info", "Pembayaran ditutup", "Klik Bayar Lagi untuk membuka ulang pembayaran.");
      }
    });
    } catch (err) {
      if (redirectUrl) {
        notify("info", "Membuka halaman pembayaran", "Popup gagal dibuka, jadi pembayaran dialihkan ke halaman Midtrans.");
        openRedirectPayment(redirectUrl);
        return;
      }
      throw err;
    }
  }

  async function retryPayment(order: Order) {
    try {
      setSubmitting(true);
      setPaymentDialog({
        type: "processing",
        title: "Membuka ulang pembayaran",
        description: "Token pembayaran sedang disiapkan lagi. Kamu bisa melanjutkan pembayaran tanpa membuat pesanan baru.",
        order,
        canRetry: true
      });
      const prepared = await prepareMidtrans(order.id);
      const payableOrder = prepared.order || order;
      setLastOrder(payableOrder);
      openSnapPayment(payableOrder, prepared.token, prepared.redirectUrl);
    } catch (err) {
      const message = getErrorMessage(err, "Gagal membuka ulang pembayaran.");
      setPaymentDialog({ type: "error", title: "Pembayaran belum bisa dibuka", description: message, order, canRetry: canRetryPayment(order) });
      notify("error", "Gagal membuka pembayaran", message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMidtrans() {
    let createdOrder: Order | null = null;
    try {
      setSubmitting(true);
      setPaymentDialog({ type: "processing", title: "Menyiapkan pembayaran", description: "Pesanan sedang dibuat dan token pembayaran Midtrans sedang disiapkan." });

      createdOrder = await createOrder("midtrans");
      setLastOrder(createdOrder);

      const prepared = await prepareMidtrans(createdOrder.id);
      const payableOrder = prepared.order || createdOrder;
      finishOrder(payableOrder);
      openSnapPayment(payableOrder, prepared.token, prepared.redirectUrl);
    } catch (err) {
      const message = getErrorMessage(err, "Gagal memproses pembayaran.");
      if (createdOrder) finishOrder(createdOrder);
      setPaymentDialog({ type: "error", title: "Pembayaran belum bisa diproses", description: message, order: createdOrder, canRetry: canRetryPayment(createdOrder) });
      notify("error", "Gagal memproses pembayaran", message);
    } finally {
      setSubmitting(false);
    }
  }

  const whatsappText = encodeURIComponent(`Halo ${settings.store_name}, saya mau tanya menu.`);
  const whatsappUrl = settings.whatsapp ? `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}?text=${whatsappText}` : "#";
  const storeLogo = settings.logo_url?.trim();

  return (
    <main className="gojek-app-shell relative min-h-screen overflow-x-hidden bg-[#f7f8f3] text-saung-dark">
      {midtransClientKey ? <Script src={snapUrl} data-client-key={midtransClientKey} strategy="afterInteractive" /> : null}
      <div className="saung-site-bg" />
      <ToastStack toasts={toasts} onClose={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
      {paymentDialog ? <PaymentModal dialog={paymentDialog} onClose={() => setPaymentDialog(null)} onRetry={paymentDialog.order ? () => retryPayment(paymentDialog.order!) : undefined} onCancelOrder={paymentDialog.order ? () => askCancelOrder(paymentDialog.order!) : undefined} onReselect={paymentDialog.order ? () => askCancelOrder(paymentDialog.order!, true) : undefined} canCancel={canCancelOrder(paymentDialog.order)} retrying={submitting} canceling={cancelingOrder} whatsappUrl={settings.whatsapp ? whatsappUrl : undefined} /> : null}
      {confirmDialog ? <ConfirmActionModal dialog={confirmDialog} busy={cancelingOrder || submitting} onClose={() => setConfirmDialog(null)} onConfirm={() => { if (confirmDialog.type === "reset-cart") resetCart(); else if (confirmDialog.order) cancelOrder(confirmDialog.order, confirmDialog.type === "cancel-and-reselect"); }} /> : null}
      {submitting ? <CustomerProcessBanner title={paymentDialog?.title || "Memproses pesanan"} description={paymentDialog?.description || "Mohon tunggu, sistem sedang menyiapkan data pesanan."} /> : null}

      <div className="mx-auto max-w-7xl px-4 pb-24 pt-4 sm:px-6 lg:px-8">
        <header className="gojek-topbar sticky top-3 z-30 mb-5 rounded-[1.8rem] border border-orange-100 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <button onClick={backToMenu} className="flex min-w-0 items-center gap-3 text-left">
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-saung-red text-xl text-white shadow-lg">
                {storeLogo ? <img src={storeLogo} alt={`Logo ${settings.store_name}`} className="h-full w-full object-cover" /> : <i className="fa-solid fa-store" /> }
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black leading-tight sm:text-base">{settings.store_name}</p>
                <p className="truncate text-[11px] font-bold text-orange-950/55">QR Menu • Meja {tableNumber}</p>
              </div>
            </button>
            <div className="flex shrink-0 items-center gap-2">
              <button onClick={goToCart} className="relative rounded-2xl bg-saung-dark px-4 py-2 text-sm font-black text-white shadow-lg transition hover:bg-saung-red">
                Keranjang
                {totalItems > 0 ? <span className="ml-2 rounded-full bg-saung-yellow px-2 py-0.5 text-xs text-saung-dark">{totalItems}</span> : null}
              </button>
            </div>
          </div>
        </header>

        {view === "menu" ? (
          <>
            <section className="mb-7">
              <div className="hero-profile-only overflow-hidden rounded-[2rem] border border-orange-100 bg-[#fff8ec] shadow-sm">
                <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
                  <div className="flex flex-col justify-between p-5 sm:p-7 lg:p-10">
                    <div>
                      <div className="mb-6 inline-flex max-w-full items-center gap-3 rounded-[1.4rem] border border-orange-100 bg-white p-3 shadow-sm">
                        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-orange-50 text-xl text-saung-red">
                          {storeLogo ? (
                            <img src={storeLogo} alt={`Logo ${settings.store_name}`} className="h-full w-full object-cover" />
                          ) : (
                            <i className="fa-solid fa-store" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-saung-orange">QR Menu Digital</p>
                          <h2 className="truncate text-xl font-black text-saung-dark sm:text-2xl">{settings.store_name}</h2>
                        </div>
                      </div>

                      <div className="mb-5 flex flex-wrap gap-2">
                        <span className="rounded-full border border-orange-100 bg-white px-4 py-2 text-xs font-black text-orange-950/70"><i className="fa-solid fa-drumstick-bite mr-2 text-saung-red" />Ayam Bakar & Goreng</span>
                        <span className="rounded-full border border-orange-100 bg-white px-4 py-2 text-xs font-black text-orange-950/70"><i className="fa-solid fa-mug-saucer mr-2 text-saung-red" />Minuman Segar</span>
                        <span className="rounded-full border border-orange-100 bg-white px-4 py-2 text-xs font-black text-orange-950/70"><i className="fa-solid fa-qrcode mr-2 text-saung-red" />Meja {tableNumber}</span>
                      </div>

                      <h1 className="max-w-3xl text-4xl font-black leading-[1.02] tracking-tight text-saung-dark sm:text-5xl lg:text-6xl">
                        Pesan menu dari meja, simpel dan cepat.
                      </h1>
                      <p className="mt-5 max-w-2xl text-base font-semibold leading-relaxed text-orange-950/65 sm:text-lg">
                        {settings.tagline || "Warkop nyaman dengan ayam bakar, ayam goreng, minuman segar, kopi, dan cemilan hangat."}
                      </p>
                    </div>

                    <div className="mt-7 space-y-5">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[1.35rem] border border-orange-100 bg-white p-4 shadow-sm">
                          <p className="text-[11px] font-black uppercase tracking-wider text-orange-950/45">Alamat</p>
                          <p className="mt-1 text-sm font-bold text-saung-dark"><i className="fa-solid fa-location-dot mr-2 text-saung-red" />{settings.address || "Alamat belum diisi"}</p>
                        </div>
                        <div className="rounded-[1.35rem] border border-orange-100 bg-white p-4 shadow-sm">
                          <p className="text-[11px] font-black uppercase tracking-wider text-orange-950/45">Jam buka</p>
                          <p className="mt-1 text-sm font-bold text-saung-dark"><i className="fa-solid fa-clock mr-2 text-saung-red" />{settings.opening_hours || "Jam buka belum diisi"}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <a href="#menu" className="rounded-2xl bg-saung-red px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-saung-dark"><i className="fa-solid fa-book-open mr-2" />Lihat Menu</a>
                        <button onClick={goToCart} className="rounded-2xl border border-orange-200 bg-white px-5 py-3 text-sm font-black text-saung-red transition hover:bg-orange-50"><i className="fa-solid fa-basket-shopping mr-2" />Checkout Pesanan</button>
                      </div>
                    </div>
                  </div>

                  <aside className="p-5 sm:p-7 lg:p-10 lg:pl-0">
                    <div className="flex h-full flex-col justify-between rounded-[1.8rem] border border-orange-100 bg-white p-5 text-center shadow-sm sm:p-7">
                      <div>
                        <div className="mx-auto grid h-32 w-32 place-items-center overflow-hidden rounded-[2rem] border border-orange-100 bg-orange-50 text-5xl text-saung-red shadow-sm sm:h-40 sm:w-40">
                          {storeLogo ? (
                            <img src={storeLogo} alt={`Logo ${settings.store_name}`} className="h-full w-full object-cover" />
                          ) : (
                            <i className="fa-solid fa-store" />
                          )}
                        </div>
                        <p className="mt-5 text-[11px] font-black uppercase tracking-[0.26em] text-saung-orange">Profil Toko</p>
                        <h3 className="mt-2 text-3xl font-black leading-tight text-saung-dark">{settings.store_name}</h3>
                        <p className="mx-auto mt-3 max-w-sm text-sm font-semibold leading-6 text-orange-950/58">{settings.tagline || "Profil toko aktif dari admin."}</p>
                      </div>

                      <div className="mt-8 grid grid-cols-3 gap-2">
                        <div className="rounded-2xl bg-[#fff8ec] p-4"><p className="text-xl font-black text-saung-dark">{data.products.length || 0}</p><p className="text-[11px] font-bold text-orange-950/50">Menu</p></div>
                        <div className="rounded-2xl bg-[#fff8ec] p-4"><p className="text-xl font-black text-saung-dark">{data.categories.length || 0}</p><p className="text-[11px] font-bold text-orange-950/50">Kategori</p></div>
                        <div className="rounded-2xl bg-[#fff8ec] p-4"><p className="text-xl font-black text-saung-dark">{data.tables.length || 0}</p><p className="text-[11px] font-bold text-orange-950/50">Meja</p></div>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            </section>

            {lastOrder ? (
              <section className="mb-7 overflow-hidden rounded-[2rem] border border-green-200 bg-white shadow-xl shadow-green-950/5">
                <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-green-700">Pesanan terakhir berhasil dibuat</p>
                    <h2 className="mt-1 text-2xl font-black text-green-950">#{lastOrder.order_code}</h2>
                    <p className="mt-1 text-sm font-semibold text-green-900/70">Meja {lastOrder.table_number} • Total {rupiah(lastOrder.total)} • {lastOrder.payment_method === "midtrans" ? "Online/Midtrans" : "Bayar di kasir"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {canRetryPayment(lastOrder) ? <button onClick={() => retryPayment(lastOrder)} className="rounded-2xl bg-saung-red px-5 py-3 text-sm font-black text-white shadow-lg">Bayar Lagi</button> : null}
                    <button onClick={() => setPaymentDialog({ type: lastOrder.payment_method === "cash" ? "cash" : lastOrder.payment_status === "lunas" ? "success" : "pending", title: paymentTitle(lastOrder), description: paymentDescription(lastOrder), order: lastOrder, canRetry: canRetryPayment(lastOrder) })} className="rounded-2xl bg-green-700 px-5 py-3 text-sm font-black text-white">Lihat Detail</button>
                  </div>
                </div>
              </section>
            ) : null}

            {error ? (
              <div className="mb-7 rounded-[2rem] border border-red-200 bg-red-50 p-5 text-red-800 shadow-lg">
                <b>Website belum tersambung database.</b>
                <p className="mt-2 text-sm">{error}</p>
              </div>
            ) : null}

            <section id="menu" className="space-y-5">
              <div className="gojek-menu-header flex flex-col gap-4 rounded-[2rem] border border-white/70 bg-white/75 p-4 shadow-xl shadow-orange-950/5 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-saung-orange">Daftar menu</p>
                  <h2 className="mt-1 text-3xl font-black tracking-tight text-saung-dark">Pilih makanan favoritmu</h2>
                </div>
                <div className="gojek-category-strip no-scrollbar hidden max-w-full gap-2 overflow-x-auto rounded-[1.4rem] bg-orange-50 p-2 lg:flex">
                  {categories.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setCategory(item.id)}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-[1.1rem] px-4 py-2.5 text-sm font-black transition ${category === item.id ? "bg-saung-red text-white shadow-lg" : "bg-white text-saung-dark hover:bg-yellow-50"}`}
                    >
                      <CategoryIcon name={item.name} /> <span>{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {featuredProducts.length ? (
                <section className="rounded-[2rem] border border-orange-100 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-saung-orange">Rekomendasi</p>
                      <h3 className="text-xl font-black text-saung-dark">Menu favorit hari ini</h3>
                    </div>
                    <i className="fa-solid fa-star text-saung-red" />
                  </div>
                  <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-3 lg:overflow-visible lg:pb-0">
                    {featuredProducts.map((product) => (
                      <article key={product.id} className="flex min-w-[190px] items-center gap-2 rounded-[1.15rem] border border-orange-100 bg-[#fffaf2] p-2.5 shadow-sm lg:min-w-0">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[1rem] bg-orange-50 text-saung-red">
                          {product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-2xl"><i className="fa-solid fa-utensils" /></div>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="line-clamp-2 text-sm font-black leading-tight text-saung-dark">{product.name}</h3>
                          <p className="mt-1 text-sm font-black text-saung-red">{rupiah(product.price)}</p>
                          <button onClick={() => addToCart(product.id)} className="mt-2 rounded-xl bg-saung-red px-3 py-1.5 text-xs font-black text-white transition hover:bg-saung-dark"><i className="fa-solid fa-plus mr-1" />Tambah</button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-72 animate-pulse rounded-[2rem] bg-white shadow-sm" />)}
                </div>
              ) : data.products.length === 0 ? (
                <div className="rounded-[2rem] border border-dashed border-orange-300 bg-white p-10 text-center shadow-sm">
                  <p className="text-4xl text-saung-red"><i className="fa-solid fa-utensils" /></p>
                  <h3 className="mt-3 text-2xl font-black">Menu belum tersedia</h3>
                  <p className="mt-2 text-sm font-semibold text-orange-950/60">Cek kategori lain atau tambah menu dari admin panel.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-6 lg:hidden">
                    {productsByCategory.map((group) => (
                      <section key={group.category.id} className="rounded-[1.8rem] border border-orange-100 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-saung-orange">Kategori</p>
                            <h3 className="text-xl font-black text-saung-dark"><CategoryIcon name={group.category.name} /> <span className="ml-2">{group.category.name}</span></h3>
                          </div>
                          <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-950/60">{group.products.length} menu</span>
                        </div>
                        <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
                          {group.products.map((product) => <CompactMenuCard key={product.id} product={product} onAdd={() => addToCart(product.id)} />)}
                        </div>
                      </section>
                    ))}
                  </div>

                  {products.length === 0 ? (
                    <div className="hidden rounded-[2rem] border border-dashed border-orange-300 bg-white p-10 text-center shadow-sm lg:block">
                      <p className="text-4xl text-saung-red"><i className="fa-solid fa-utensils" /></p>
                      <h3 className="mt-3 text-2xl font-black">Menu di kategori ini kosong</h3>
                      <p className="mt-2 text-sm font-semibold text-orange-950/60">Cek kategori lain atau tambah menu dari admin panel.</p>
                    </div>
                  ) : (
                    <section className="gojek-menu-grid hidden gap-5 lg:grid lg:grid-cols-3">
                      {products.map((product) => (
                        <MenuCard key={product.id} product={product} onAdd={() => addToCart(product.id)} />
                      ))}
                    </section>
                  )}
                </>
              )}
            </section>
          </>
        ) : (
          <section className="gojek-checkout grid gap-6 lg:grid-cols-[1fr_420px]">
            <div className="space-y-5">
              <div className="rounded-[2.25rem] border border-white/70 bg-white/80 p-5 shadow-xl shadow-orange-950/10 backdrop-blur-xl sm:p-7">
                <div className="mb-4 flex flex-wrap gap-2">
                  <button onClick={keepCartAndPickMore} className="rounded-2xl bg-orange-50 px-4 py-2 text-sm font-black text-saung-red"><i className="fa-solid fa-arrow-left mr-2" />Pilih ulang / tambah menu</button>
                  <button onClick={askResetCart} className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-red-700">Batalkan keranjang</button>
                </div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-saung-orange">Checkout terpisah</p>
                <h1 className="mt-1 text-4xl font-black tracking-tight sm:text-5xl">Keranjang Pesanan</h1>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-orange-950/60">Atur jumlah, catatan item, data pemesan, lalu pilih pembayaran. Halaman ini dibuat terpisah supaya menu tidak sesak dan checkout lebih rapi.</p>
              </div>

              <div className="rounded-[2.25rem] border border-white/70 bg-white/80 p-4 shadow-xl shadow-orange-950/10 backdrop-blur-xl sm:p-5">
                {cartLines.length === 0 ? (
                  <div className="grid min-h-72 place-items-center rounded-[1.8rem] border border-dashed border-orange-300 bg-orange-50 p-8 text-center">
                    <div>
                      <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-[2rem] bg-white text-3xl shadow"><i className="fa-solid fa-basket-shopping" /></div>
                      <h2 className="text-2xl font-black">Keranjang kosong</h2>
                      <p className="mt-2 text-sm font-semibold text-orange-950/60">Balik ke menu dan pilih makanan dulu.</p>
                      <button onClick={backToMenu} className="btn-primary mt-5">Pilih Menu</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cartLines.map((item) => (
                      <article key={item.product_id} className="grid gap-4 rounded-[1.8rem] border border-orange-100 bg-white p-4 shadow-sm sm:grid-cols-[88px_1fr_auto] sm:items-start">
                        <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-[1.4rem] bg-orange-50 text-4xl sm:h-24 sm:w-24">
                          {item.product.image_url ? <img src={item.product.image_url} alt={item.product.name} className="h-full w-full object-cover" /> : <i className="fa-solid fa-utensils" /> }
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-lg font-black leading-tight">{item.product.name}</h3>
                          <p className="mt-1 text-sm font-black text-saung-red">{rupiah(item.product.price)} × {item.quantity} = {rupiah(item.subtotal)}</p>
                          <input value={item.note || ""} onChange={(e) => updateNote(item.product_id, e.target.value)} className="mt-3 w-full rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-semibold outline-none focus:border-saung-orange focus:bg-white" placeholder="Catatan item: pedas, tanpa sambal, dll" />
                          <button onClick={() => changeQty(item.product_id, 0)} className="mt-2 text-sm font-black text-red-600 hover:text-red-800"><i className="fa-solid fa-trash mr-1" />Hapus menu ini</button>
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-2xl bg-orange-50 p-2 sm:flex-col sm:bg-transparent sm:p-0">
                          <button onClick={() => changeQty(item.product_id, item.quantity + 1)} className="grid h-10 w-10 place-items-center rounded-full bg-white font-black text-saung-red shadow">+</button>
                          <span className="w-12 text-center text-xl font-black">{item.quantity}</span>
                          <button onClick={() => changeQty(item.product_id, item.quantity - 1)} className="grid h-10 w-10 place-items-center rounded-full bg-white font-black text-saung-red shadow">−</button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <aside ref={paymentSummaryRef} id="ringkasan-pembayaran" className="scroll-mt-24 lg:sticky lg:top-24 lg:h-fit">
              <div className="overflow-hidden rounded-[2.25rem] border border-white/70 bg-white shadow-2xl shadow-orange-950/10">
                <div className="bg-saung-red p-5 text-white">
                  <p className="text-sm font-black text-white/75">Ringkasan pembayaran</p>
                  <h2 className="mt-1 text-3xl font-black">Meja {tableNumber}</h2>
                  <p className="mt-2 text-sm font-semibold text-white/80">{totalItems} item • {cartLines.length} menu berbeda</p>
                </div>
                <div className="space-y-4 p-5">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    <div>
                      <label className="mb-1 block text-[11px] font-black uppercase tracking-wider text-orange-950/55">Nomor Meja</label>
                      <select value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} className="input">
                        {data.tables.length ? data.tables.map((table) => <option key={table.id} value={table.table_number}>{table.label || `Meja ${table.table_number}`}</option>) : <option value={tableNumber}>Meja {tableNumber}</option>}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-black uppercase tracking-wider text-orange-950/55">Nama Pelanggan</label>
                      <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input" placeholder="Contoh: Daffa" />
                    </div>
                  </div>
                  <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="input" placeholder="No. HP opsional" />
                  <textarea value={orderNote} onChange={(e) => setOrderNote(e.target.value)} className="input min-h-24" placeholder="Catatan pesanan opsional" />

                  <div className="space-y-2 rounded-[1.6rem] bg-saung-dark p-5 text-white">
                    <div className="flex justify-between text-sm"><span>Subtotal</span><b>{rupiah(subtotal)}</b></div>
                    <div className="flex justify-between text-sm"><span>Service fee {settings.service_fee_percent || 0}%</span><b>{rupiah(serviceFee)}</b></div>
                    <div className="flex justify-between border-t border-white/15 pt-4 text-xl"><span className="font-black">Total</span><b className="text-saung-yellow">{rupiah(total)}</b></div>
                  </div>

                  <div className="grid gap-2 rounded-[1.5rem] border border-orange-100 bg-orange-50 p-3">
                    <button onClick={keepCartAndPickMore} disabled={submitting || cartLines.length === 0} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-saung-dark shadow-sm transition hover:bg-yellow-50 disabled:cursor-not-allowed disabled:opacity-60">Pilih ulang / tambah menu</button>
                    <button onClick={askResetCart} disabled={submitting || cartLines.length === 0} className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60">Batalkan semua pesanan</button>
                  </div>

                  <div className="grid gap-2">
                    <button disabled={submitting || cartLines.length === 0} onClick={handleMidtrans} className="btn-primary flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60">
                      {submitting ? <MiniSpinner light /> : <i className="fa-solid fa-credit-card" />}
                      <span>{submitting ? "Menyiapkan pembayaran..." : "Bayar Online Midtrans"}</span>
                    </button>
                    <button disabled={submitting || cartLines.length === 0} onClick={handleCash} className="flex items-center justify-center gap-2 rounded-2xl border-2 border-saung-red bg-white px-5 py-3 font-black text-saung-red transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60">
                      {submitting ? <MiniSpinner /> : <i className="fa-solid fa-cash-register" />}
                      <span>{submitting ? "Mengirim pesanan..." : "Bayar di Kasir"}</span>
                    </button>
                    {settings.whatsapp ? <a href={whatsappUrl} target="_blank" className="rounded-2xl bg-green-50 px-5 py-3 text-center text-sm font-black text-green-700">Chat WhatsApp Kedai</a> : null}
                  </div>
                </div>
              </div>
            </aside>
          </section>
        )}
      </div>

      {view === "menu" && totalItems > 0 ? (
        <div className="fixed inset-x-0 bottom-4 z-30 px-4">
          <button onClick={goToCart} className="mx-auto flex w-full max-w-xl items-center justify-between rounded-[1.6rem] bg-saung-dark px-5 py-4 text-white shadow-2xl shadow-red-950/30 transition hover:bg-saung-red">
            <span className="text-left"><b className="block text-sm"><i className="fa-solid fa-basket-shopping mr-2" />Lihat Keranjang</b><span className="text-xs text-white/70">{totalItems} item siap checkout</span></span>
            <span className="rounded-2xl bg-saung-yellow px-4 py-2 text-sm font-black text-saung-dark">{rupiah(total)}</span>
          </button>
        </div>
      ) : null}

      {view === "cart" && totalItems > 0 ? (
        <div className="fixed inset-x-0 bottom-4 z-30 px-4 lg:hidden">
          <button onClick={scrollToPaymentSummary} className="gojek-mobile-pay mx-auto flex w-full max-w-xl items-center justify-between rounded-[1.6rem] bg-saung-red px-5 py-4 text-white shadow-2xl shadow-red-950/30 transition hover:bg-saung-dark">
            <span className="text-left"><b className="block text-sm"><i className="fa-solid fa-credit-card mr-2" />Bayar Sekarang</b><span className="text-xs text-white/75">Scroll ke ringkasan pembayaran</span></span>
            <span className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-saung-red">{rupiah(total)}</span>
          </button>
        </div>
      ) : null}
    </main>
  );
}

function CompactMenuCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  return (
    <article className="min-w-[180px] max-w-[180px] overflow-hidden rounded-[1.25rem] border border-orange-100 bg-[#fffaf2] shadow-sm">
      <div className="h-28 overflow-hidden bg-orange-50 text-saung-red">
        {product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-3xl"><i className="fa-solid fa-utensils" /></div>}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-black leading-tight text-saung-dark">{product.name}</h3>
        <p className="mt-1 line-clamp-2 min-h-[2rem] text-xs font-semibold text-orange-950/55">{product.description || "Menu favorit Kedai Saung Bambu."}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-sm font-black text-saung-red">{rupiah(product.price)}</p>
          <button onClick={onAdd} className="rounded-xl bg-saung-red px-3 py-2 text-xs font-black text-white"><i className="fa-solid fa-plus" /></button>
        </div>
      </div>
    </article>
  );
}

function MenuCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  return (
    <article className="gojek-menu-card group overflow-hidden rounded-[2.1rem] border border-orange-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="gojek-menu-card-image relative h-52 overflow-hidden bg-orange-50">
        {product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="grid h-full place-items-center text-5xl text-saung-red"><i className="fa-solid fa-utensils" /></div>}
        {product.badge ? <span className="absolute left-4 top-4 rounded-full bg-saung-yellow px-3 py-1 text-[11px] font-black text-saung-dark shadow-lg">{product.badge}</span> : null}
      </div>
      <div className="p-5">
        <h3 className="line-clamp-2 min-h-[3.2rem] text-xl font-black leading-tight text-saung-dark">{product.name}</h3>
        <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-relaxed text-orange-950/60">{product.description || "Menu favorit Kedai Saung Bambu."}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-orange-950/45">Harga</p>
            <p className="text-2xl font-black text-saung-red">{rupiah(product.price)}</p>
          </div>
          <button onClick={onAdd} className="rounded-2xl bg-saung-dark px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-saung-red"><i className="fa-solid fa-plus mr-2" />Tambah</button>
        </div>
      </div>
    </article>
  );
}

function ToastStack({ toasts, onClose }: { toasts: Toast[]; onClose: (id: number) => void }) {
  return (
    <div className="fixed right-4 top-24 z-50 grid w-[calc(100%-2rem)] max-w-sm gap-3 sm:top-6">
      {toasts.map((toast) => {
        const styles = toast.type === "success" ? "border-green-200 bg-green-50 text-green-950" : toast.type === "error" ? "border-red-200 bg-red-50 text-red-950" : "border-orange-200 bg-orange-50 text-orange-950";
        const icon = toast.type === "success" ? "fa-solid fa-circle-check" : toast.type === "error" ? "fa-solid fa-triangle-exclamation" : "fa-solid fa-circle-info";
        return (
          <div key={toast.id} className={`rounded-[1.4rem] border p-4 shadow-2xl backdrop-blur ${styles}`}>
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/70 text-saung-red"><i className={icon} /></span>
              <div className="min-w-0 flex-1">
                <p className="font-black">{toast.title}</p>
                {toast.description ? <p className="mt-1 text-sm opacity-80">{toast.description}</p> : null}
              </div>
              <button onClick={() => onClose(toast.id)} className="rounded-full px-2 font-black opacity-60 hover:opacity-100">×</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MiniSpinner({ light = false, size = "h-5 w-5" }: { light?: boolean; size?: string }) {
  return <span className={`inline-block ${size} animate-spin rounded-full border-2 ${light ? "border-white/35 border-t-white" : "border-saung-red/25 border-t-saung-red"}`} />;
}

function CustomerProcessBanner({ title, description }: { title: string; description: string }) {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-saung-dark/55 px-4 backdrop-blur-xl">
            <div className="relative w-full max-w-sm overflow-hidden rounded-[2.25rem] border border-white/70 bg-white/95 p-6 text-center text-saung-dark shadow-2xl shadow-red-950/35 backdrop-blur-2xl">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-saung-yellow/35 blur-2xl" />
        <div className="absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-saung-red/20 blur-2xl" />
        <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-[1.7rem] bg-saung-red shadow-sm">
          <MiniSpinner light size="h-9 w-9" />
        </div>
        <p className="relative mt-5 text-xs font-black uppercase tracking-[0.28em] text-saung-orange">Sedang proses</p>
        <h3 className="relative mt-2 text-2xl font-black leading-tight">{title}</h3>
        <p className="relative mx-auto mt-2 max-w-xs text-sm font-semibold leading-relaxed text-orange-950/60">{description}</p>
        <div className="relative mt-6 h-2 overflow-hidden rounded-full bg-orange-100">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-saung-red" />
        </div>
        <p className="relative mt-3 text-xs font-bold text-orange-950/45">Tunggu sebentar ya, jangan tutup halaman ini.</p>
      </div>
    </div>
  );
}

function PaymentModal({ dialog, onClose, onRetry, onCancelOrder, onReselect, canCancel, retrying, canceling, whatsappUrl }: { dialog: PaymentDialog; onClose: () => void; onRetry?: () => void; onCancelOrder?: () => void; onReselect?: () => void; canCancel?: boolean; retrying?: boolean; canceling?: boolean; whatsappUrl?: string }) {
  const icons: Record<PaymentDialog["type"], string> = {
    processing: "fa-solid fa-spinner",
    success: "fa-solid fa-circle-check",
    pending: "fa-solid fa-clock",
    error: "fa-solid fa-triangle-exclamation",
    closed: "fa-solid fa-circle-info",
    cash: "fa-solid fa-cash-register"
  };
  const tone: Record<PaymentDialog["type"], string> = {
    processing: "bg-saung-red",
    success: "bg-green-700",
    pending: "bg-saung-orange",
    error: "bg-red-700",
    closed: "bg-saung-dark",
    cash: "bg-saung-red"
  };

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-saung-dark/55 px-4 backdrop-blur-md">
      <div className="w-full max-w-md overflow-hidden rounded-[2.4rem] bg-white shadow-2xl">
        <div className={`${tone[dialog.type]} p-6 text-white`}>
          <div className="mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-white/20 text-4xl backdrop-blur">
            {dialog.type === "processing" ? <MiniSpinner light size="h-9 w-9" /> : <i className={icons[dialog.type]} />}
          </div>
          <p className="text-sm font-bold text-white/80">Status pesanan</p>
          <h2 className="mt-1 text-3xl font-black leading-tight">{dialog.title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/90">{dialog.description}</p>
        </div>
        <div className="space-y-4 p-5">
          {dialog.order ? (
            <div className="rounded-[1.5rem] bg-orange-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-orange-700">Kode pesanan</p>
                  <p className="text-2xl font-black text-saung-dark">#{dialog.order.order_code}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-orange-950/60">Total</p>
                  <p className="font-black text-saung-red">{rupiah(dialog.order.total)}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold text-orange-950/70">
                <span className="rounded-2xl bg-white px-3 py-2">Meja {dialog.order.table_number}</span>
                <span className="rounded-2xl bg-white px-3 py-2">{dialog.order.payment_method === "midtrans" ? "Online" : "Kasir"}</span>
              </div>
            </div>
          ) : null}
          {dialog.redirectUrl ? (
            <a href={dialog.redirectUrl} className="block w-full rounded-2xl bg-saung-red px-5 py-3 text-center font-black text-white shadow-lg transition hover:bg-saung-dark">
              Buka Halaman Pembayaran
            </a>
          ) : null}
          {dialog.canRetry && onRetry ? (
            <button onClick={onRetry} disabled={retrying || canceling} className="w-full rounded-2xl border-2 border-saung-red bg-white px-5 py-3 font-black text-saung-red shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60">
              {retrying ? <span className="inline-flex items-center justify-center gap-2"><MiniSpinner /> Membuka pembayaran...</span> : "Bayar Lagi"}
            </button>
          ) : null}
          {canCancel ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <button onClick={onReselect} disabled={canceling || retrying} className="rounded-2xl bg-orange-50 px-5 py-3 font-black text-saung-red transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60">
                {canceling ? <span className="inline-flex items-center justify-center gap-2"><MiniSpinner /> Memproses...</span> : "Batalkan & Pilih Ulang"}
              </button>
              <button onClick={onCancelOrder} disabled={canceling || retrying} className="rounded-2xl border-2 border-red-200 bg-red-50 px-5 py-3 font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60">Batalkan Pesanan</button>
            </div>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={onClose} className="rounded-2xl bg-saung-dark px-5 py-3 font-black text-white">Tutup</button>
            {whatsappUrl ? <a href={whatsappUrl} target="_blank" className="rounded-2xl bg-green-600 px-5 py-3 text-center font-black text-white">Chat Kedai</a> : <Link href="/" className="rounded-2xl bg-orange-50 px-5 py-3 text-center font-black text-saung-red">Lihat Menu</Link>}
          </div>
        </div>
      </div>
    </div>
  );
}


function ConfirmActionModal({ dialog, onClose, onConfirm, busy }: { dialog: ConfirmDialog; onClose: () => void; onConfirm: () => void; busy?: boolean }) {
  const isDanger = dialog.type !== "reset-cart";
  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-saung-dark/55 px-4 backdrop-blur-xl">
      <div className="w-full max-w-md overflow-hidden rounded-[2.2rem] border border-white/70 bg-white shadow-2xl shadow-red-950/25">
        <div className={`${isDanger ? "bg-red-700" : "bg-saung-dark"} p-6 text-white`}>
          <div className="mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-white/20 text-4xl backdrop-blur">{isDanger ? <i className="fa-solid fa-triangle-exclamation" /> : <i className="fa-solid fa-basket-shopping" />}</div>
          <p className="text-sm font-bold text-white/75">Konfirmasi</p>
          <h2 className="mt-1 text-3xl font-black leading-tight">{dialog.title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/90">{dialog.description}</p>
        </div>
        <div className="space-y-3 p-5">
          {dialog.order ? (
            <div className="rounded-[1.4rem] bg-orange-50 p-4 text-sm font-bold text-orange-950/75">
              Order #{dialog.order.order_code} • Meja {dialog.order.table_number} • {rupiah(dialog.order.total)}
            </div>
          ) : null}
          <button onClick={onConfirm} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-saung-red px-5 py-3 font-black text-white shadow-lg transition hover:bg-saung-dark disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? <><MiniSpinner light /> Memproses...</> : dialog.type === "reset-cart" ? "Ya, kosongkan keranjang" : dialog.type === "cancel-and-reselect" ? "Ya, batalkan & pilih ulang" : "Ya, batalkan pesanan"}
          </button>
          <button onClick={onClose} disabled={busy} className="w-full rounded-2xl bg-orange-50 px-5 py-3 font-black text-saung-red transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60">Kembali</button>
        </div>
      </div>
    </div>
  );
}
