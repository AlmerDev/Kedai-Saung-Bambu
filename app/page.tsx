"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useMemo, useState } from "react";
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
};

type ViewMode = "menu" | "cart";

const midtransClientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || "";
const snapUrl = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true" ? "https://app.midtrans.com/snap/snap.js" : "https://app.sandbox.midtrans.com/snap/snap.js";

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
  const [view, setView] = useState<ViewMode>("menu");

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

  const categories = useMemo(() => [{ id: "semua", name: "Semua", emoji: "🔥", slug: "semua", sort_order: 0, is_active: true }, ...data.categories], [data.categories]);
  const products = useMemo(() => data.products.filter((item) => category === "semua" || item.category_id === category), [category, data.products]);

  const featuredProducts = useMemo(() => data.products.slice(0, 3), [data.products]);

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
    const payload = await response.json();
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
    return order.payment_method === "midtrans" && !["lunas", "refund"].includes(order.payment_status) && order.status !== "selesai";
  }

  function paymentTitle(order: Order) {
    if (order.payment_status === "lunas") return "Pembayaran berhasil";
    if (order.payment_status === "gagal") return "Pembayaran gagal";
    if (order.payment_status === "expire") return "Pembayaran kedaluwarsa";
    if (order.payment_status === "refund") return "Pembayaran refund";
    return "Pembayaran menunggu";
  }

  function paymentDescription(order: Order) {
    if (order.payment_status === "lunas") return "Status order otomatis berubah menjadi lunas dan pesanan masuk ke dapur untuk diproses.";
    if (order.payment_status === "gagal") return "Transaksi belum berhasil. Kamu bisa membuka ulang pembayaran atau bayar langsung di kasir.";
    if (order.payment_status === "expire") return "Waktu pembayaran sudah habis. Kamu bisa membuka ulang pembayaran dari tombol Bayar Lagi.";
    if (order.payment_status === "refund") return "Transaksi tercatat refund. Hubungi admin kedai untuk pengecekan.";
    return "Pesanan sudah tersimpan. Selesaikan pembayaran dari popup Midtrans atau klik Bayar Lagi kalau popup tertutup.";
  }

  async function fetchOrder(orderId: string) {
    const response = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Gagal mengambil detail order.");
    return payload.order as Order;
  }

  async function syncPayment(orderId: string) {
    const response = await fetch(`/api/orders/${orderId}/sync-payment`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Gagal mengecek status pembayaran.");
    return payload.order as Order;
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
    const payload = await response.json();
    if (!response.ok || !payload.token) throw new Error(payload.error || "Gagal membuat transaksi Midtrans.");
    return { token: String(payload.token), order: (payload.order || null) as Order | null };
  }

  function openSnapPayment(order: Order, token: string) {
    setPaymentDialog({
      type: "processing",
      title: "Membuka pembayaran Midtrans",
      description: "Pilih QRIS, e-wallet, atau metode lain di popup pembayaran. Kalau popup tertutup, kamu bisa klik Bayar Lagi.",
      order,
      canRetry: true
    });
    notify("info", "Pembayaran dibuka", "Selesaikan pembayaran di popup Midtrans.");

    window.snap?.pay(token, {
      onSuccess: async () => {
        const syncedOrder = await getLatestMidtransOrder(order.id);
        finishOrder(syncedOrder);
        setPaymentDialog({
          type: syncedOrder.payment_status === "lunas" ? "success" : "pending",
          title: paymentTitle(syncedOrder),
          description: paymentDescription(syncedOrder),
          order: syncedOrder,
          canRetry: canRetryPayment(syncedOrder)
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
          canRetry: canRetryPayment(syncedOrder)
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
          canRetry: canRetryPayment(syncedOrder)
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
          canRetry: canRetryPayment(syncedOrder)
        });
        notify("info", "Pembayaran ditutup", "Klik Bayar Lagi untuk membuka ulang pembayaran.");
      }
    });
  }

  async function retryPayment(order: Order) {
    try {
      if (!midtransClientKey) throw new Error("Midtrans belum aktif. Isi ENV Midtrans dulu.");
      if (!window.snap) throw new Error("Snap Midtrans belum siap. Coba klik lagi beberapa detik.");

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
      openSnapPayment(payableOrder, prepared.token);
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
      if (!midtransClientKey) throw new Error("Midtrans belum aktif. Isi ENV Midtrans dulu.");
      if (!window.snap) throw new Error("Snap Midtrans belum siap. Coba klik lagi beberapa detik.");

      setSubmitting(true);
      setPaymentDialog({ type: "processing", title: "Menyiapkan pembayaran", description: "Pesanan sedang dibuat dan token pembayaran Midtrans sedang disiapkan." });

      createdOrder = await createOrder("midtrans");
      setLastOrder(createdOrder);

      const prepared = await prepareMidtrans(createdOrder.id);
      const payableOrder = prepared.order || createdOrder;
      finishOrder(payableOrder);
      openSnapPayment(payableOrder, prepared.token);
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
  const storeHero = settings.hero_image_url?.trim();

  return (
    <main className="relative min-h-screen overflow-x-hidden text-saung-dark">
      {midtransClientKey ? <Script src={snapUrl} data-client-key={midtransClientKey} strategy="afterInteractive" /> : null}
      <div className="saung-site-bg" />
      <ToastStack toasts={toasts} onClose={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
      {paymentDialog ? <PaymentModal dialog={paymentDialog} onClose={() => setPaymentDialog(null)} onRetry={paymentDialog.order ? () => retryPayment(paymentDialog.order!) : undefined} retrying={submitting} whatsappUrl={settings.whatsapp ? whatsappUrl : undefined} /> : null}

      <div className="mx-auto max-w-7xl px-4 pb-24 pt-4 sm:px-6 lg:px-8">
        <header className="sticky top-3 z-30 mb-5 rounded-[1.8rem] border border-white/70 bg-white/80 px-4 py-3 shadow-xl shadow-orange-950/10 backdrop-blur-2xl">
          <div className="flex items-center justify-between gap-3">
            <button onClick={backToMenu} className="flex min-w-0 items-center gap-3 text-left">
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-saung-red to-saung-orange text-xl text-white shadow-lg">
                {storeLogo ? <img src={storeLogo} alt={`Logo ${settings.store_name}`} className="h-full w-full object-cover" /> : "竹"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black leading-tight sm:text-base">{settings.store_name}</p>
                <p className="truncate text-[11px] font-bold text-orange-950/55">QR Menu • Meja {tableNumber}</p>
              </div>
            </button>
            <div className="flex shrink-0 items-center gap-2">
              <Link href="/admin" className="hidden rounded-2xl bg-orange-50 px-4 py-2 text-sm font-black text-saung-red sm:inline-flex">Admin</Link>
              <button onClick={goToCart} className="relative rounded-2xl bg-saung-dark px-4 py-2 text-sm font-black text-white shadow-lg transition hover:bg-saung-red">
                Keranjang
                {totalItems > 0 ? <span className="ml-2 rounded-full bg-saung-yellow px-2 py-0.5 text-xs text-saung-dark">{totalItems}</span> : null}
              </button>
            </div>
          </div>
        </header>

        {view === "menu" ? (
          <>
            <section className="relative mb-7 overflow-hidden rounded-[2.5rem] border border-white/60 bg-[#5f050b] p-5 text-white shadow-2xl shadow-red-950/20 sm:p-8 lg:p-10">
              {storeHero ? <img src={storeHero} alt={`Banner ${settings.store_name}`} className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 bg-gradient-to-br from-[#5f050b] via-saung-red to-saung-orange" />}
              <div className="absolute inset-0 bg-gradient-to-r from-[#240504]/90 via-[#7a1014]/78 to-[#f97316]/60" />
              <div className="absolute inset-0 hero-weave opacity-25" />
              <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-saung-yellow/35 blur-3xl" />
              <div className="absolute -bottom-32 left-1/3 h-96 w-96 rounded-full bg-white/15 blur-3xl" />
              <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
                <div>
                  <div className="mb-6 flex items-center gap-4 rounded-[1.6rem] border border-white/15 bg-white/12 p-3 backdrop-blur-xl sm:w-fit sm:pr-6">
                    <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-[1.35rem] border border-white/20 bg-white/90 text-3xl text-saung-red shadow-xl">
                      {storeLogo ? <img src={storeLogo} alt={`Logo ${settings.store_name}`} className="h-full w-full object-cover" /> : "🎋"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-saung-yellow">QR Menu Digital</p>
                      <h2 className="truncate text-xl font-black sm:text-2xl">{settings.store_name}</h2>
                    </div>
                  </div>
                  <div className="mb-5 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/20 bg-white/15 px-4 py-2 text-xs font-black backdrop-blur">🍗 Ayam Bakar & Goreng</span>
                    <span className="rounded-full border border-white/20 bg-white/15 px-4 py-2 text-xs font-black backdrop-blur">🥤 Minuman Segar</span>
                    <span className="rounded-full border border-white/20 bg-white/15 px-4 py-2 text-xs font-black backdrop-blur">⚡ Pesan dari meja</span>
                  </div>
                  <h1 className="max-w-3xl text-4xl font-black leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">Makan santai rasa saung, pesan cukup dari meja.</h1>
                  <p className="mt-5 max-w-2xl text-base leading-relaxed text-orange-50/90 sm:text-lg">{settings.tagline}</p>
                  <div className="mt-7 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.4rem] border border-white/20 bg-white/15 p-4 backdrop-blur">
                      <p className="text-xs font-black uppercase tracking-wider text-white/65">Alamat</p>
                      <p className="mt-1 font-bold">📍 {settings.address || "Alamat belum diisi"}</p>
                    </div>
                    <div className="rounded-[1.4rem] border border-white/20 bg-white/15 p-4 backdrop-blur">
                      <p className="text-xs font-black uppercase tracking-wider text-white/65">Jam buka</p>
                      <p className="mt-1 font-bold">🕒 {settings.opening_hours || "Jam buka belum diisi"}</p>
                    </div>
                  </div>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <a href="#menu" className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-saung-red shadow-xl transition hover:-translate-y-0.5">Lihat Menu</a>
                    <button onClick={goToCart} className="rounded-2xl border border-white/30 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur transition hover:bg-white/25">Checkout Pesanan</button>
                  </div>
                </div>

                <div className="relative">
                  <div className="rounded-[2.25rem] border border-white/20 bg-white/15 p-3 backdrop-blur-xl">
                    <div className="overflow-hidden rounded-[1.8rem] bg-saung-cream text-saung-dark shadow-2xl">
                      <div className="relative grid min-h-80 place-items-center overflow-hidden bg-gradient-to-br from-yellow-200 via-orange-200 to-red-200 p-8">
                        {storeHero ? <img src={storeHero} alt={`Banner ${settings.store_name}`} className="absolute inset-0 h-full w-full object-cover" /> : null}
                        <div className={`absolute inset-0 ${storeHero ? "bg-gradient-to-t from-white via-white/70 to-white/15" : "food-dots opacity-55"}`} />
                        <div className="relative text-center">
                          <div className="mx-auto mb-4 grid h-28 w-28 place-items-center overflow-hidden rounded-[2rem] bg-white/80 text-6xl shadow-xl ring-1 ring-white/80">
                            {storeLogo ? <img src={storeLogo} alt={`Logo ${settings.store_name}`} className="h-full w-full object-cover" /> : "🍗"}
                          </div>
                          <p className="text-xs font-black uppercase tracking-[0.3em] text-saung-red">Profil Toko</p>
                          <h2 className="mt-2 text-3xl font-black">{settings.store_name}</h2>
                          <p className="mx-auto mt-2 max-w-xs text-sm font-semibold text-orange-950/65">{settings.tagline || "Ayam bakar, ayam goreng, minuman segar, dan cemilan ala saung."}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 divide-x divide-orange-100 bg-white p-4 text-center">
                        <div><p className="text-lg font-black">{data.products.length || "--"}</p><p className="text-[11px] font-bold text-orange-950/55">Menu</p></div>
                        <div><p className="text-lg font-black">{data.categories.length || "--"}</p><p className="text-[11px] font-bold text-orange-950/55">Kategori</p></div>
                        <div><p className="text-lg font-black">{data.tables.length || "--"}</p><p className="text-[11px] font-bold text-orange-950/55">Meja</p></div>
                      </div>
                    </div>
                  </div>
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
              <div className="flex flex-col gap-4 rounded-[2rem] border border-white/70 bg-white/75 p-4 shadow-xl shadow-orange-950/5 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-saung-orange">Daftar menu</p>
                  <h2 className="mt-1 text-3xl font-black tracking-tight text-saung-dark">Pilih makanan favoritmu</h2>
                </div>
                <div className="no-scrollbar flex max-w-full gap-2 overflow-x-auto rounded-[1.4rem] bg-orange-50 p-2">
                  {categories.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setCategory(item.id)}
                      className={`shrink-0 rounded-[1.1rem] px-4 py-2.5 text-sm font-black transition ${category === item.id ? "bg-saung-red text-white shadow-lg" : "bg-white text-saung-dark hover:bg-yellow-50"}`}
                    >
                      {item.emoji || "🍽️"} {item.name}
                    </button>
                  ))}
                </div>
              </div>

              {featuredProducts.length ? (
                <section className="grid gap-4 lg:grid-cols-3">
                  {featuredProducts.map((product, index) => (
                    <article key={product.id} className="relative overflow-hidden rounded-[2rem] bg-saung-dark p-5 text-white shadow-xl shadow-orange-950/10">
                      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-saung-orange/45 blur-2xl" />
                      <p className="relative text-xs font-black uppercase tracking-wider text-saung-yellow">Rekomendasi #{index + 1}</p>
                      <h3 className="relative mt-2 line-clamp-2 text-xl font-black">{product.name}</h3>
                      <div className="relative mt-4 flex items-end justify-between gap-3">
                        <p className="text-2xl font-black text-saung-yellow">{rupiah(product.price)}</p>
                        <button onClick={() => addToCart(product.id)} className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-saung-red">Tambah</button>
                      </div>
                    </article>
                  ))}
                </section>
              ) : null}

              {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-72 animate-pulse rounded-[2rem] bg-white/75 shadow" />)}
                </div>
              ) : products.length === 0 ? (
                <div className="rounded-[2rem] border border-dashed border-orange-300 bg-white/80 p-10 text-center shadow-xl">
                  <p className="text-4xl">🍽️</p>
                  <h3 className="mt-3 text-2xl font-black">Menu belum tersedia</h3>
                  <p className="mt-2 text-sm font-semibold text-orange-950/60">Cek kategori lain atau tambah menu dari admin panel.</p>
                </div>
              ) : (
                <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {products.map((product) => (
                    <MenuCard key={product.id} product={product} onAdd={() => addToCart(product.id)} />
                  ))}
                </section>
              )}
            </section>
          </>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
            <div className="space-y-5">
              <div className="rounded-[2.25rem] border border-white/70 bg-white/80 p-5 shadow-xl shadow-orange-950/10 backdrop-blur-xl sm:p-7">
                <button onClick={backToMenu} className="mb-4 rounded-2xl bg-orange-50 px-4 py-2 text-sm font-black text-saung-red">← Kembali ke menu</button>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-saung-orange">Checkout terpisah</p>
                <h1 className="mt-1 text-4xl font-black tracking-tight sm:text-5xl">Keranjang Pesanan</h1>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-orange-950/60">Atur jumlah, catatan item, data pemesan, lalu pilih pembayaran. Halaman ini dibuat terpisah supaya menu tidak sesak dan checkout lebih rapi.</p>
              </div>

              <div className="rounded-[2.25rem] border border-white/70 bg-white/80 p-4 shadow-xl shadow-orange-950/10 backdrop-blur-xl sm:p-5">
                {cartLines.length === 0 ? (
                  <div className="grid min-h-72 place-items-center rounded-[1.8rem] border border-dashed border-orange-300 bg-orange-50 p-8 text-center">
                    <div>
                      <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-[2rem] bg-white text-5xl shadow">🧺</div>
                      <h2 className="text-2xl font-black">Keranjang kosong</h2>
                      <p className="mt-2 text-sm font-semibold text-orange-950/60">Balik ke menu dan pilih makanan dulu.</p>
                      <button onClick={backToMenu} className="btn-primary mt-5">Pilih Menu</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cartLines.map((item) => (
                      <article key={item.product_id} className="grid gap-4 rounded-[1.8rem] border border-orange-100 bg-white p-4 shadow-sm sm:grid-cols-[88px_1fr_auto] sm:items-start">
                        <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-[1.4rem] bg-gradient-to-br from-yellow-100 to-orange-100 text-4xl sm:h-24 sm:w-24">
                          {item.product.image_url ? <img src={item.product.image_url} alt={item.product.name} className="h-full w-full object-cover" /> : "🍽️"}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-lg font-black leading-tight">{item.product.name}</h3>
                          <p className="mt-1 text-sm font-black text-saung-red">{rupiah(item.product.price)} × {item.quantity} = {rupiah(item.subtotal)}</p>
                          <input value={item.note || ""} onChange={(e) => updateNote(item.product_id, e.target.value)} className="mt-3 w-full rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-semibold outline-none focus:border-saung-orange focus:bg-white" placeholder="Catatan item: pedas, tanpa sambal, dll" />
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

            <aside className="lg:sticky lg:top-24 lg:h-fit">
              <div className="overflow-hidden rounded-[2.25rem] border border-white/70 bg-white shadow-2xl shadow-orange-950/10">
                <div className="bg-gradient-to-br from-saung-red via-saung-orange to-saung-yellow p-5 text-white">
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

                  <div className="grid gap-2">
                    <button disabled={submitting || cartLines.length === 0} onClick={handleMidtrans} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Memproses..." : "Bayar Online Midtrans"}</button>
                    <button disabled={submitting || cartLines.length === 0} onClick={handleCash} className="rounded-2xl border-2 border-saung-red bg-white px-5 py-3 font-black text-saung-red transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60">Bayar di Kasir</button>
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
            <span className="text-left"><b className="block text-sm">Lihat Keranjang</b><span className="text-xs text-white/70">{totalItems} item siap checkout</span></span>
            <span className="rounded-2xl bg-saung-yellow px-4 py-2 text-sm font-black text-saung-dark">{rupiah(total)}</span>
          </button>
        </div>
      ) : null}
    </main>
  );
}

function MenuCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  return (
    <article className="group overflow-hidden rounded-[2.1rem] border border-white/70 bg-white shadow-xl shadow-orange-950/5 transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-orange-950/10">
      <div className="relative h-52 overflow-hidden bg-gradient-to-br from-yellow-100 via-orange-100 to-red-100">
        {product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="grid h-full place-items-center text-7xl">🍽️</div>}
        <div className="absolute inset-0 bg-gradient-to-t from-saung-dark/40 to-transparent" />
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
          <button onClick={onAdd} className="rounded-2xl bg-saung-dark px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-saung-red">Tambah</button>
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
        const icon = toast.type === "success" ? "✅" : toast.type === "error" ? "⚠️" : "ℹ️";
        return (
          <div key={toast.id} className={`rounded-[1.4rem] border p-4 shadow-2xl backdrop-blur ${styles}`}>
            <div className="flex items-start gap-3">
              <span className="text-xl">{icon}</span>
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

function PaymentModal({ dialog, onClose, onRetry, retrying, whatsappUrl }: { dialog: PaymentDialog; onClose: () => void; onRetry?: () => void; retrying?: boolean; whatsappUrl?: string }) {
  const icons: Record<PaymentDialog["type"], string> = {
    processing: "⏳",
    success: "✅",
    pending: "🕒",
    error: "⚠️",
    closed: "📌",
    cash: "🧾"
  };
  const tone: Record<PaymentDialog["type"], string> = {
    processing: "from-saung-red via-saung-orange to-saung-yellow",
    success: "from-green-600 via-emerald-500 to-lime-400",
    pending: "from-orange-600 via-saung-orange to-saung-yellow",
    error: "from-red-700 via-saung-red to-orange-500",
    closed: "from-saung-dark via-saung-red to-saung-orange",
    cash: "from-saung-red via-saung-orange to-saung-yellow"
  };

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-saung-dark/55 px-4 backdrop-blur-md">
      <div className="w-full max-w-md overflow-hidden rounded-[2.4rem] bg-white shadow-2xl">
        <div className={`bg-gradient-to-br ${tone[dialog.type]} p-6 text-white`}>
          <div className="mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-white/20 text-4xl backdrop-blur">{icons[dialog.type]}</div>
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
          {dialog.canRetry && onRetry ? (
            <button onClick={onRetry} disabled={retrying} className="w-full rounded-2xl bg-saung-red px-5 py-3 font-black text-white shadow-lg transition hover:bg-saung-dark disabled:cursor-not-allowed disabled:opacity-60">
              {retrying ? "Membuka pembayaran..." : "Bayar Lagi"}
            </button>
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
