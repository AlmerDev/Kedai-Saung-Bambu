"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Category, DiningTable, Order, Product, StoreSettings } from "@/lib/types";
import { rupiah } from "@/lib/format";

type Tab = "dashboard" | "orders" | "products" | "categories" | "tables" | "reports" | "settings";
type EditorState = null | { type: "product" | "category" | "table"; mode: "create" | "edit" };

type ProductForm = {
  id?: string;
  name: string;
  category_id: string;
  description: string;
  price: string;
  image_url: string;
  badge: string;
  sort_order: string;
  is_available: boolean;
};

type CategoryForm = { id?: string; name: string; emoji: string; sort_order: string; is_active: boolean };
type TableForm = { id?: string; table_number: string; label: string; is_active: boolean };
type SettingsForm = {
  store_name: string;
  tagline: string;
  address: string;
  whatsapp: string;
  service_fee_percent: string;
  opening_hours: string;
  logo_url: string;
  hero_image_url: string;
};

type NewOrderNotice = {
  id: string;
  order_code: string;
  table_number: string | null;
  customer_name: string;
  total: number;
  created_at: string;
};

const emptyProduct: ProductForm = {
  name: "",
  category_id: "",
  description: "",
  price: "0",
  image_url: "",
  badge: "",
  sort_order: "0",
  is_available: true
};
const emptyCategory: CategoryForm = { name: "", emoji: "fa-solid fa-utensils", sort_order: "0", is_active: true };
const emptyTable: TableForm = { table_number: "", label: "", is_active: true };

const navItems: { key: Tab; label: string; icon: string; desc: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "fa-solid fa-chart-line", desc: "Ringkasan usaha" },
  { key: "orders", label: "Pesanan", icon: "fa-solid fa-receipt", desc: "Order masuk" },
  { key: "products", label: "Menu", icon: "fa-solid fa-utensils", desc: "Makanan & minuman" },
  { key: "categories", label: "Kategori", icon: "fa-solid fa-layer-group", desc: "Kelompok menu" },
  { key: "tables", label: "Meja & QR", icon: "fa-solid fa-qrcode", desc: "QR tiap meja" },
  { key: "reports", label: "Laporan", icon: "fa-solid fa-file-export", desc: "Rekap jualan" },
  { key: "settings", label: "Setting", icon: "fa-solid fa-gear", desc: "Profil kedai" }
];

function toDateInput(value: Date) {
  const offset = value.getTimezoneOffset();
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function firstDayOfMonthInput() {
  const now = new Date();
  return toDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
}

function categoryIconClass(name?: string | null, stored?: string | null) {
  if (stored?.startsWith("fa-")) return stored;
  const value = (name || "").toLowerCase();
  if (value.includes("ayam")) return "fa-solid fa-drumstick-bite";
  if (value.includes("minum") || value.includes("kopi") || value.includes("teh")) return "fa-solid fa-mug-saucer";
  if (value.includes("ringan") || value.includes("cemilan") || value.includes("snack")) return "fa-solid fa-cookie-bite";
  if (value.includes("nasi") || value.includes("paket")) return "fa-solid fa-bowl-food";
  return "fa-solid fa-utensils";
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inputClass(extra = "") {
  return `w-full rounded-2xl border border-orange-300/80 bg-[#fff8ea] px-4 py-3 text-sm font-semibold text-saung-dark shadow-inner shadow-orange-950/5 outline-none transition placeholder:text-orange-950/35 focus:border-saung-orange focus:bg-white focus:ring-4 focus:ring-orange-100 ${extra}`;
}

function statusBadge(status: string) {
  if (["lunas", "selesai", "siap"].includes(status)) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (["baru", "diproses", "menunggu"].includes(status)) return "bg-amber-50 text-amber-700 ring-amber-200";
  if (["dibatalkan", "gagal", "expire", "refund"].includes(status)) return "bg-red-50 text-red-700 ring-red-200";
  return "bg-slate-50 text-slate-700 ring-slate-200";
}

function prettyChannel(value?: string | null) {
  if (!value) return "";
  const upper = value.toUpperCase();
  if (["BCA", "BNI", "BRI", "MANDIRI", "PERMATA", "CIMB"].includes(upper)) return upper;
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" " );
}

function paymentMethodInfo(order: Pick<Order, "payment_method" | "payment_type" | "payment_channel" | "payment_reference" | "payment_status">) {
  if (order.payment_method === "cash") {
    return {
      icon: "fa-solid fa-money-bill-wave",
      label: "Bayar di Kasir",
      detail: "Tunai/manual",
      tone: "bg-emerald-50 text-emerald-700 ring-emerald-200"
    };
  }

  const type = (order.payment_type || "midtrans").toLowerCase();
  const channel = prettyChannel(order.payment_channel);
  const reference = order.payment_reference ? `Ref: ${order.payment_reference}` : "";
  const map: Record<string, { icon: string; label: string }> = {
    midtrans: { icon: "fa-solid fa-credit-card", label: "Midtrans" },
    qris: { icon: "fa-solid fa-qrcode", label: "QRIS" },
    gopay: { icon: "fa-solid fa-wallet", label: "GoPay" },
    shopeepay: { icon: "fa-solid fa-wallet", label: "ShopeePay" },
    dana: { icon: "fa-solid fa-wallet", label: "DANA" },
    linkaja: { icon: "fa-solid fa-wallet", label: "LinkAja" },
    bank_transfer: { icon: "fa-solid fa-building-columns", label: channel ? `VA ${channel}` : "Virtual Account" },
    echannel: { icon: "fa-solid fa-building-columns", label: "Mandiri Bill" },
    cstore: { icon: "fa-solid fa-store", label: channel || "Convenience Store" },
    credit_card: { icon: "fa-solid fa-credit-card", label: "Kartu Kredit" }
  };

  const info = map[type] || { icon: "fa-solid fa-credit-card", label: prettyChannel(type) || "Midtrans" };
  return {
    icon: info.icon,
    label: info.label,
    detail: reference || (order.payment_status === "menunggu" ? "Menunggu pilihan bayar" : "Pembayaran online"),
    tone: "bg-blue-50 text-blue-700 ring-blue-200"
  };
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<Tab>("dashboard");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [editor, setEditor] = useState<EditorState>(null);
  const [productQuery, setProductQuery] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState<SettingsForm | null>(null);
  const [newOrderNotice, setNewOrderNotice] = useState<NewOrderNotice | null>(null);
  const [unreadOrders, setUnreadOrders] = useState(0);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [reportFrom, setReportFrom] = useState(firstDayOfMonthInput);
  const [reportTo, setReportTo] = useState(() => toDateInput(new Date()));

  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const orderWatcherReadyRef = useRef(false);
  const notificationEnabledRef = useRef(false);

  const [productForm, setProductForm] = useState<ProductForm>(emptyProduct);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategory);
  const [tableForm, setTableForm] = useState<TableForm>(emptyTable);
  const [deleteTarget, setDeleteTarget] = useState<{ path: string; label: string } | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState(false);

  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    notificationEnabledRef.current = notificationEnabled;
  }, [notificationEnabled]);

  async function api<T>(url: string, options?: RequestInit): Promise<T> {
    const headers = new Headers(options?.headers);
    if (!(options?.body instanceof FormData)) headers.set("Content-Type", "application/json");
    const response = await fetch(url, { ...options, headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Terjadi kesalahan.");
    return payload as T;
  }

  async function checkAuth() {
    const payload = await api<{ authenticated: boolean }>("/api/auth/me").catch(() => ({ authenticated: false }));
    setAuthenticated(payload.authenticated);
    if (payload.authenticated) await loadAll();
  }

  function selectTab(nextTab: Tab) {
    setTab(nextTab);
    if (nextTab === "orders") {
      setUnreadOrders(0);
      setNewOrderNotice(null);
    }
  }

  function playNewOrderSound() {
    if (!notificationEnabledRef.current || typeof window === "undefined") return;
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const audio = new AudioContextClass();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(780, audio.currentTime);
      oscillator.frequency.setValueAtTime(980, audio.currentTime + 0.12);
      gain.gain.setValueAtTime(0.001, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, audio.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.45);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + 0.48);
      window.setTimeout(() => audio.close().catch(() => undefined), 700);
    } catch {
      // Browser bisa memblokir audio kalau belum ada interaksi user. Abaikan supaya admin tetap jalan.
    }
  }

  function showBrowserNotification(order: NewOrderNotice) {
    if (!notificationEnabledRef.current || typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    try {
      new Notification("Pesanan baru masuk", {
        body: `#${order.order_code} • Meja ${order.table_number || "-"} • ${rupiah(order.total)}`,
        icon: "/favicon.ico"
      });
    } catch {
      // Abaikan jika browser menolak native notification.
    }
  }

  function registerIncomingOrders(nextOrders: Order[]) {
    setOrders(nextOrders);

    if (!orderWatcherReadyRef.current) {
      knownOrderIdsRef.current = new Set(nextOrders.map((order) => order.id));
      orderWatcherReadyRef.current = true;
      return;
    }

    const freshOrders = nextOrders.filter((order) => !knownOrderIdsRef.current.has(order.id));
    nextOrders.forEach((order) => knownOrderIdsRef.current.add(order.id));

    if (!freshOrders.length) return;

    const newest = freshOrders[0];
    const notice: NewOrderNotice = {
      id: newest.id,
      order_code: newest.order_code,
      table_number: newest.table_number,
      customer_name: newest.customer_name,
      total: newest.total,
      created_at: newest.created_at
    };

    setUnreadOrders((count) => count + freshOrders.length);
    setNewOrderNotice(notice);
    playNewOrderSound();
    showBrowserNotification(notice);
  }

  async function requestNotificationAccess() {
    setNotificationEnabled(true);
    notificationEnabledRef.current = true;

    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      notify("Notifikasi aktif di dashboard. Browser ini belum mendukung notifikasi sistem.");
      return;
    }

    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    setNotificationPermission(permission);
    if (permission === "granted") notify("Notifikasi pesanan baru aktif. Jangan tutup halaman admin ya.");
    else if (permission === "denied") notify("Notifikasi browser ditolak. Toast di dashboard tetap aktif.");
    else notify("Notifikasi dashboard aktif. Izinkan notifikasi browser kalau mau popup sistem.");
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [cat, prod, tabRes, orderRes, settingRes] = await Promise.all([
        api<{ categories: Category[] }>("/api/admin/categories"),
        api<{ products: Product[] }>("/api/admin/products"),
        api<{ tables: DiningTable[] }>("/api/admin/tables"),
        api<{ orders: Order[] }>("/api/admin/orders"),
        api<{ settings: StoreSettings }>("/api/admin/settings")
      ]);
      setCategories(cat.categories);
      setProducts(prod.products);
      setTables(tabRes.tables);
      registerIncomingOrders(orderRes.orders);
      setSettings(settingRes.settings);
      setSettingsForm({
        store_name: settingRes.settings.store_name || "",
        tagline: settingRes.settings.tagline || "",
        address: settingRes.settings.address || "",
        whatsapp: settingRes.settings.whatsapp || "",
        service_fee_percent: String(settingRes.settings.service_fee_percent ?? 0),
        opening_hours: settingRes.settings.opening_hours || "",
        logo_url: settingRes.settings.logo_url || "",
        hero_image_url: settingRes.settings.hero_image_url || ""
      });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("ksb-admin-notification-enabled") === "true";
      setNotificationEnabled(saved);
      notificationEnabledRef.current = saved;
      setNotificationPermission("Notification" in window ? Notification.permission : "unsupported");
    }
    checkAuth();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("ksb-admin-notification-enabled", String(notificationEnabled));
  }, [notificationEnabled]);

  useEffect(() => {
    if (authenticated !== true) return;
    const timer = window.setInterval(async () => {
      try {
        const payload = await api<{ orders: Order[] }>("/api/admin/orders?limit=120");
        registerIncomingOrders(payload.orders);
      } catch {
        // Polling notifikasi sengaja silent supaya tidak mengganggu admin.
      }
    }, 7000);
    return () => window.clearInterval(timer);
  }, [authenticated]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const now = new Date();
    const isPaid = (order: Order) => order.payment_status === "lunas" || order.payment_method === "cash";
    const todayOrders = orders.filter((order) => new Date(order.created_at).toDateString() === today);
    const monthOrders = orders.filter((order) => {
      const date = new Date(order.created_at);
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    });
    const paidOrders = orders.filter(isPaid);
    const paidToday = todayOrders.filter(isPaid);
    const paidMonth = monthOrders.filter(isPaid);
    const orderItems = orders.flatMap((order) => order.order_items || []);
    const productMap = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const item of orderItems) {
      const current = productMap.get(item.product_name) || { name: item.product_name, qty: 0, revenue: 0 };
      current.qty += Number(item.quantity || 0);
      current.revenue += Number(item.subtotal || 0);
      productMap.set(item.product_name, current);
    }
    const bestProducts = Array.from(productMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);
    const paymentSummary = {
      cash: orders.filter((order) => order.payment_method === "cash").length,
      midtrans: orders.filter((order) => order.payment_method === "midtrans").length,
      qris: orders.filter((order) => (order.payment_type || "").toLowerCase() === "qris").length,
      va: orders.filter((order) => (order.payment_type || "").toLowerCase() === "bank_transfer").length
    };

    const dailyRevenue = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const dayKey = date.toDateString();
      const dayOrders = orders.filter((order) => new Date(order.created_at).toDateString() === dayKey);
      const paidDayOrders = dayOrders.filter(isPaid);
      return {
        label: date.toLocaleDateString("id-ID", { weekday: "short" }),
        date: date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
        revenue: paidDayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
        orders: dayOrders.length
      };
    });

    const statusSummary = [
      { label: "Baru", value: orders.filter((order) => order.status === "baru").length, icon: "fa-solid fa-bell-concierge" },
      { label: "Diproses", value: orders.filter((order) => order.status === "diproses").length, icon: "fa-solid fa-fire-burner" },
      { label: "Siap", value: orders.filter((order) => order.status === "siap").length, icon: "fa-solid fa-box-open" },
      { label: "Selesai", value: orders.filter((order) => order.status === "selesai").length, icon: "fa-solid fa-circle-check" },
      { label: "Batal", value: orders.filter((order) => order.status === "dibatalkan").length, icon: "fa-solid fa-ban" }
    ];

    const paymentChart = [
      { label: "Kasir", value: orders.filter((order) => order.payment_method === "cash").length, icon: "fa-solid fa-cash-register" },
      { label: "Midtrans", value: orders.filter((order) => order.payment_method === "midtrans").length, icon: "fa-solid fa-credit-card" },
      { label: "QRIS", value: orders.filter((order) => (order.payment_type || "").toLowerCase() === "qris").length, icon: "fa-solid fa-qrcode" },
      { label: "VA", value: orders.filter((order) => (order.payment_type || "").toLowerCase() === "bank_transfer").length, icon: "fa-solid fa-building-columns" }
    ];

    return {
      products: products.length,
      activeProducts: products.filter((item) => item.is_available).length,
      categories: categories.length,
      tables: tables.length,
      ordersToday: todayOrders.length,
      ordersMonth: monthOrders.length,
      ordersAll: orders.length,
      omzetToday: paidToday.reduce((sum, order) => sum + order.total, 0),
      omzetMonth: paidMonth.reduce((sum, order) => sum + order.total, 0),
      omzetAll: paidOrders.reduce((sum, order) => sum + order.total, 0),
      avgTicket: paidOrders.length ? Math.round(paidOrders.reduce((sum, order) => sum + order.total, 0) / paidOrders.length) : 0,
      pendingOrders: orders.filter((order) => ["baru", "diproses"].includes(order.status)).length,
      readyOrders: orders.filter((order) => order.status === "siap").length,
      doneOrders: orders.filter((order) => order.status === "selesai").length,
      canceledOrders: orders.filter((order) => order.status === "dibatalkan").length,
      unpaidOrders: orders.filter((order) => ["belum_bayar", "menunggu"].includes(order.payment_status)).length,
      paidOrders: paidOrders.length,
      cashOrdersToday: todayOrders.filter((order) => order.payment_method === "cash").length,
      midtransOrdersToday: todayOrders.filter((order) => order.payment_method === "midtrans").length,
      paidMidtransToday: todayOrders.filter((order) => order.payment_method === "midtrans" && order.payment_status === "lunas").length,
      waitingMidtransToday: todayOrders.filter((order) => order.payment_method === "midtrans" && order.payment_status === "menunggu").length,
      bestProducts,
      paymentSummary,
      dailyRevenue,
      statusSummary,
      paymentChart
    };
  }, [orders, products, categories, tables]);

  const filteredProducts = useMemo(() => {
    const keyword = productQuery.trim().toLowerCase();
    if (!keyword) return products;
    return products.filter((product) => [product.name, product.description, product.category?.name, product.badge].join(" ").toLowerCase().includes(keyword));
  }, [products, productQuery]);

  const recentOrders = orders.slice(0, 6);
  const latestProducts = products.slice(0, 5);

  const reportOrders = useMemo(() => {
    const from = reportFrom ? new Date(`${reportFrom}T00:00:00`) : null;
    const to = reportTo ? new Date(`${reportTo}T23:59:59`) : null;
    return orders.filter((order) => {
      const date = new Date(order.created_at);
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });
  }, [orders, reportFrom, reportTo]);

  const reportStats = useMemo(() => {
    const paid = reportOrders.filter((order) => order.payment_status === "lunas" || order.payment_method === "cash");
    const items = reportOrders.flatMap((order) => (order.order_items || []).map((item) => ({ ...item, order })));
    const productMap = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const item of items) {
      const current = productMap.get(item.product_name) || { name: item.product_name, qty: 0, revenue: 0 };
      current.qty += Number(item.quantity || 0);
      current.revenue += Number(item.subtotal || 0);
      productMap.set(item.product_name, current);
    }
    return {
      totalOrders: reportOrders.length,
      paidOrders: paid.length,
      unpaidOrders: reportOrders.filter((order) => ["belum_bayar", "menunggu"].includes(order.payment_status)).length,
      canceledOrders: reportOrders.filter((order) => order.status === "dibatalkan").length,
      revenue: paid.reduce((sum, order) => sum + order.total, 0),
      items,
      products: Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue)
    };
  }, [reportOrders]);

  function reportRowsHtml() {
    const rows = reportOrders.map((order) => `
      <tr>
        <td>${escapeHtml(new Date(order.created_at).toLocaleString("id-ID"))}</td>
        <td>${escapeHtml(order.order_code)}</td>
        <td>${escapeHtml(order.table_number || "-")}</td>
        <td>${escapeHtml(order.customer_name)}</td>
        <td>${escapeHtml(order.payment_method === "midtrans" ? paymentMethodInfo(order).label : "Bayar Kasir")}</td>
        <td>${escapeHtml(order.payment_status)}</td>
        <td>${escapeHtml(order.status)}</td>
        <td>${order.subtotal}</td>
        <td>${order.service_fee}</td>
        <td>${order.total}</td>
      </tr>`).join("");
    return rows || `<tr><td colspan="10">Tidak ada data pada periode ini.</td></tr>`;
  }

  function downloadBlob(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportReportExcel() {
    const html = `
      <html><head><meta charset="utf-8" /></head><body>
      <h2>Rekap Jualan ${escapeHtml(settings?.store_name || "KEDAI SAUNG BAMBU")}</h2>
      <p>Periode: ${escapeHtml(reportFrom)} s/d ${escapeHtml(reportTo)}</p>
      <table border="1">
        <thead><tr><th>Tanggal</th><th>Kode</th><th>Meja</th><th>Pelanggan</th><th>Metode</th><th>Pembayaran</th><th>Status</th><th>Subtotal</th><th>Service Fee</th><th>Total</th></tr></thead>
        <tbody>${reportRowsHtml()}</tbody>
      </table>
      </body></html>`;
    downloadBlob(`rekap-kedai-saung-bambu-${reportFrom}-${reportTo}.xls`, `\ufeff${html}`, "application/vnd.ms-excel;charset=utf-8");
  }

  function exportReportPdf() {
    const html = `
      <html><head><title>Rekap Jualan</title><meta charset="utf-8" />
      <style>body{font-family:Arial,sans-serif;padding:28px;color:#2a0908}h1{margin:0 0 6px}p{margin:4px 0 18px;color:#6b4b3a}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#9b111e;color:white;text-align:left}td,th{border:1px solid #ddd;padding:8px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}.box{border:1px solid #f3c27d;border-radius:12px;padding:12px;background:#fff8ea}.box b{display:block;font-size:18px;margin-top:4px}</style>
      </head><body>
        <h1>Rekap Jualan ${escapeHtml(settings?.store_name || "KEDAI SAUNG BAMBU")}</h1>
        <p>Periode: ${escapeHtml(reportFrom)} s/d ${escapeHtml(reportTo)}</p>
        <div class="summary">
          <div class="box">Total Omzet<b>${escapeHtml(rupiah(reportStats.revenue))}</b></div>
          <div class="box">Total Order<b>${reportStats.totalOrders}</b></div>
          <div class="box">Order Lunas<b>${reportStats.paidOrders}</b></div>
          <div class="box">Belum Lunas<b>${reportStats.unpaidOrders}</b></div>
        </div>
        <table><thead><tr><th>Tanggal</th><th>Kode</th><th>Meja</th><th>Pelanggan</th><th>Metode</th><th>Pembayaran</th><th>Status</th><th>Subtotal</th><th>Service Fee</th><th>Total</th></tr></thead><tbody>${reportRowsHtml()}</tbody></table>
        <script>window.onload=()=>{window.print();}</script>
      </body></html>`;
    const win = window.open("", "_blank");
    if (!win) {
      notify("Popup browser diblokir. Izinkan popup dulu untuk export PDF.");
      return;
    }
    win.document.write(html);
    win.document.close();
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setActionLoading("Memeriksa password admin...");
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) });
      setAuthenticated(true);
      await loadAll();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Login gagal.");
    } finally {
      setActionLoading("");
    }
  }

  async function logout() {
    setActionLoading("Keluar dari admin...");
    try {
      await api("/api/auth/logout", { method: "POST" });
      setAuthenticated(false);
    } finally {
      setActionLoading("");
    }
  }

  function notify(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage((current) => (current === text ? "" : current)), 4500);
  }

  function openProductCreate() {
    setProductForm(emptyProduct);
    setEditor({ type: "product", mode: "create" });
  }

  function openProductEdit(product: Product) {
    setProductForm({
      id: product.id,
      name: product.name,
      category_id: product.category_id || "",
      description: product.description || "",
      price: String(product.price),
      image_url: product.image_url || "",
      badge: product.badge || "",
      sort_order: String(product.sort_order || 0),
      is_available: product.is_available
    });
    setEditor({ type: "product", mode: "edit" });
  }

  function openCategoryCreate() {
    setCategoryForm(emptyCategory);
    setEditor({ type: "category", mode: "create" });
  }

  function openCategoryEdit(category: Category) {
    setCategoryForm({ id: category.id, name: category.name, emoji: category.emoji?.startsWith("fa-") ? category.emoji : categoryIconClass(category.name, category.emoji), sort_order: String(category.sort_order || 0), is_active: category.is_active });
    setEditor({ type: "category", mode: "edit" });
  }

  function openTableCreate() {
    setTableForm(emptyTable);
    setEditor({ type: "table", mode: "create" });
  }

  function openTableEdit(table: DiningTable) {
    setTableForm({ id: table.id, table_number: table.table_number, label: table.label || "", is_active: table.is_active });
    setEditor({ type: "table", mode: "edit" });
  }

  function closeEditor() {
    setEditor(null);
    setProductForm(emptyProduct);
    setCategoryForm(emptyCategory);
    setTableForm(emptyTable);
  }

  async function saveCategory(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setActionLoading(categoryForm.id ? "Menyimpan perubahan kategori..." : "Menambahkan kategori baru...");
    try {
      const body = JSON.stringify({ ...categoryForm, sort_order: Number(categoryForm.sort_order || 0) });
      if (categoryForm.id) await api(`/api/admin/categories/${categoryForm.id}`, { method: "PATCH", body });
      else await api("/api/admin/categories", { method: "POST", body });
      closeEditor();
      await loadAll();
      notify(categoryForm.id ? "Kategori berhasil diperbarui." : "Kategori baru berhasil ditambahkan.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal simpan kategori.");
    } finally {
      setActionLoading("");
    }
  }

  async function saveTable(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setActionLoading(tableForm.id ? "Menyimpan perubahan meja..." : "Menambahkan meja baru...");
    try {
      const body = JSON.stringify(tableForm);
      if (tableForm.id) await api(`/api/admin/tables/${tableForm.id}`, { method: "PATCH", body });
      else await api("/api/admin/tables", { method: "POST", body });
      closeEditor();
      await loadAll();
      notify(tableForm.id ? "Meja berhasil diperbarui." : "Meja baru berhasil ditambahkan.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal simpan meja.");
    } finally {
      setActionLoading("");
    }
  }

  async function saveProduct(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setActionLoading(productForm.id ? "Menyimpan perubahan menu..." : "Menambahkan menu baru...");
    try {
      const body = JSON.stringify({
        ...productForm,
        category_id: productForm.category_id || null,
        price: Number(productForm.price || 0),
        sort_order: Number(productForm.sort_order || 0)
      });
      if (productForm.id) await api(`/api/admin/products/${productForm.id}`, { method: "PATCH", body });
      else await api("/api/admin/products", { method: "POST", body });
      closeEditor();
      await loadAll();
      notify(productForm.id ? "Menu berhasil diperbarui." : "Menu baru berhasil ditambahkan.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal simpan menu.");
    } finally {
      setActionLoading("");
    }
  }

  async function uploadFile(file?: File, folder = "menu") {
    if (!file) return "";
    setMessage("");
    setActionLoading(folder === "settings" ? "Mengupload foto toko..." : "Mengupload foto menu...");
    const form = new FormData();
    form.append("file", file);
    form.append("folder", folder);
    try {
      const response = await fetch("/api/admin/upload", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Upload gagal.");
      notify("Gambar berhasil diupload.");
      return String(payload.url || "");
    } finally {
      setActionLoading("");
    }
  }

  async function uploadProductImage(file?: File) {
    try {
      const url = await uploadFile(file, "menu");
      if (url) setProductForm((current) => ({ ...current, image_url: url }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload gambar gagal.");
    }
  }

  async function uploadSettingImage(field: "logo_url" | "hero_image_url", file?: File) {
    try {
      const url = await uploadFile(file, "settings");
      if (url) setSettingsForm((current) => (current ? { ...current, [field]: url } : current));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload gambar gagal.");
    }
  }

  async function deletePhotoFromStorage(url?: string | null) {
    if (!url) return;
    await api<{ deleted?: boolean; skipped?: boolean; message?: string }>("/api/admin/upload/delete", {
      method: "DELETE",
      body: JSON.stringify({ url })
    });
  }

  async function deleteProductImage() {
    if (!productForm.image_url || deletingPhoto) return;
    setDeletingPhoto(true);
    setActionLoading("Menghapus foto menu...");
    setMessage("Menghapus foto menu...");
    try {
      await deletePhotoFromStorage(productForm.image_url);
      const nextForm = { ...productForm, image_url: "" };
      setProductForm(nextForm);
      if (productForm.id) {
        await api(`/api/admin/products/${productForm.id}`, { method: "PATCH", body: JSON.stringify({ image_url: "" }) });
        await loadAll();
      }
      notify("Foto menu berhasil dihapus.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal hapus foto menu.");
    } finally {
      setDeletingPhoto(false);
      setActionLoading("");
    }
  }

  async function deleteSavedProductImage(product: Product) {
    if (!product.image_url || deletingPhoto) return;
    setDeletingPhoto(true);
    setActionLoading("Menghapus foto menu...");
    setMessage("Menghapus foto menu...");
    try {
      await deletePhotoFromStorage(product.image_url);
      await api(`/api/admin/products/${product.id}`, { method: "PATCH", body: JSON.stringify({ image_url: "" }) });
      await loadAll();
      notify(`Foto ${product.name} berhasil dihapus.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal hapus foto menu.");
    } finally {
      setDeletingPhoto(false);
      setActionLoading("");
    }
  }

  async function deleteSettingImage(field: "logo_url" | "hero_image_url", label: string) {
    if (!settingsForm?.[field] || deletingPhoto) return;
    setDeletingPhoto(true);
    setActionLoading(`Menghapus ${label}...`);
    setMessage(`Menghapus ${label}...`);
    try {
      await deletePhotoFromStorage(settingsForm[field]);
      const nextForm = { ...settingsForm, [field]: "" };
      setSettingsForm(nextForm);
      await api("/api/admin/settings", { method: "PATCH", body: JSON.stringify(nextForm) });
      await loadAll();
      notify(`${label} berhasil dihapus.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : `Gagal hapus ${label}.`);
    } finally {
      setDeletingPhoto(false);
      setActionLoading("");
    }
  }

  async function saveSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!settingsForm) return;
    setMessage("");
    setActionLoading("Menyimpan setting toko...");
    try {
      await api("/api/admin/settings", { method: "PATCH", body: JSON.stringify(settingsForm) });
      await loadAll();
      notify("Setting toko berhasil disimpan.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal simpan setting.");
    } finally {
      setActionLoading("");
    }
  }

  async function patchOrder(id: string, payload: Partial<Order>) {
    setMessage("");
    setActionLoading("Mengupdate status order...");
    try {
      await api(`/api/admin/orders/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
      await loadAll();
      notify("Status order berhasil diperbarui.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal update order.");
    } finally {
      setActionLoading("");
    }
  }

  function remove(path: string, label: string) {
    setDeleteTarget({ path, label });
  }

  async function confirmRemove() {
    if (!deleteTarget) return;
    setActionLoading(`Menghapus ${deleteTarget.label}...`);
    try {
      await api(deleteTarget.path, { method: "DELETE" });
      await loadAll();
      notify(`${deleteTarget.label} berhasil dihapus.`);
      setDeleteTarget(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal hapus data.");
    } finally {
      setActionLoading("");
    }
  }

  if (authenticated === null) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f1e8] px-4">
        <div className="rounded-2xl border border-[#eadbc6] bg-white px-6 py-5 font-black text-saung-dark shadow-sm">Memuat admin...</div>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f6f1e8] px-4 py-10">
        <div className="absolute inset-0 bg-[#f6f1e8]" />
        <form onSubmit={handleLogin} className="relative w-full max-w-md rounded-[1.5rem] border border-[#eadbc6] bg-white p-8 text-saung-dark shadow-sm">
          <div className="mb-7 flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-saung-yellow text-2xl shadow-glow"><i className="fa-solid fa-store" /></div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-saung-orange">Admin Panel</p>
              <h1 className="text-2xl font-black">KEDAI SAUNG BAMBU</h1>
            </div>
          </div>
          <p className="mb-5 text-sm leading-6 text-orange-950/60">Masuk untuk mengatur dashboard, pesanan, menu, QR meja, foto toko, dan pembayaran.</p>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="w-full rounded-xl border border-[#eadbc6] bg-[#fff8ec] px-4 py-4 text-sm font-bold text-saung-dark outline-none placeholder:text-orange-950/40 focus:ring-4 focus:ring-orange-100" placeholder="Password admin" />
          {message ? <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{message}</p> : null}
          <button disabled={!!actionLoading} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-saung-red px-5 py-4 font-black text-white shadow-sm transition hover:bg-saung-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70">
            {actionLoading ? <AdminSpinner light /> : <i className="fa-solid fa-lock" />}
            <span>{actionLoading || "Masuk Admin"}</span>
          </button>
          <Link href="/" className="mt-5 block text-center text-sm font-bold text-saung-red">← Kembali ke menu pelanggan</Link>
        </form>
      </main>
    );
  }

  return (
    <main className="admin-gojek-shell human-admin min-h-screen bg-[#f6f1e8] text-saung-dark">
      <div className="admin-gojek-backdrop fixed inset-0" />
      <div className="relative grid min-h-screen lg:grid-cols-[300px_1fr]">
        <aside className="admin-gojek-sidebar admin-sidebar-scroll border-b border-orange-100 bg-white p-4 text-saung-dark lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r lg:p-5">
          <div className="flex items-center gap-4 rounded-[2rem] border border-orange-100 bg-[#fff8ec] p-4 shadow-sm">
            <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-white text-2xl text-saung-red shadow-sm">
              {settings?.logo_url ? <img src={settings.logo_url} alt={`Logo ${settings.store_name}`} className="h-full w-full object-cover" /> : <i className="fa-solid fa-store" />}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-saung-orange">Admin Suite</p>
              <h1 className="truncate text-lg font-black">{settings?.store_name || "Saung Bambu"}</h1>
            </div>
          </div>

          <nav className="no-scrollbar mt-4 flex gap-3 overflow-x-auto lg:grid lg:overflow-visible">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => selectTab(item.key)}
                className={`admin-nav-item relative flex min-w-[170px] items-center gap-3 rounded-2xl px-4 py-3 text-left transition lg:min-w-0 ${tab === item.key ? "admin-nav-active bg-saung-red text-white shadow-sm" : "bg-[#fff8ec] text-orange-950/65 hover:bg-white hover:text-saung-dark"}`}
              >
                <span className="admin-nav-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-lg text-saung-red shadow-sm"><i className={item.icon} /></span>
                <span>
                  <span className="block text-sm font-black">{item.label}</span>
                  <span className="admin-nav-desc block text-xs text-orange-950/50">{item.desc}</span>
                </span>
                {item.key === "orders" && unreadOrders > 0 ? <span className="ml-auto grid h-6 min-w-6 place-items-center rounded-full bg-red-600 px-1 text-xs font-black text-white ring-2 ring-white/30">{unreadOrders}</span> : null}
              </button>
            ))}
          </nav>

          <div className="mt-5 hidden rounded-[2rem] border border-orange-100 bg-[#fff8ec] p-4 lg:block">
            <p className="text-sm font-black text-saung-dark">Status toko</p>
            <div className="mt-3 space-y-2 text-sm text-orange-950/60">
              <p className="flex justify-between"><span>Menu aktif</span><b className="text-saung-dark">{stats.activeProducts}</b></p>
              <p className="flex justify-between"><span>Order aktif</span><b className="text-saung-yellow">{stats.pendingOrders}</b></p>
              <p className="flex justify-between"><span>Meja</span><b className="text-saung-dark">{stats.tables}</b></p>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <Link href="/" className="flex-1 rounded-2xl bg-[#fff4db] px-4 py-3 text-center text-sm font-black text-saung-red transition hover:bg-yellow-50"><i className="fa-solid fa-store mr-2" />Menu</Link>
            <button onClick={logout} className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700 transition hover:bg-red-100"><i className="fa-solid fa-right-from-bracket mr-2" />Logout</button>
          </div>
        </aside>

        <section className="admin-content admin-gojek-content min-w-0 p-4 sm:p-6 lg:p-8">
          <header className="admin-gojek-header mb-6 overflow-hidden rounded-[2.2rem] border border-orange-100 bg-[#fffaf1] shadow-sm">
            <div className="relative p-6 sm:p-7">
              <div className="absolute inset-0 bg-[#fffaf1]" />
              <div className="absolute right-0 top-0 h-40 w-40 rounded-bl-[5rem] bg-[#fff1d8]" />
              <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-3xl bg-saung-red text-3xl text-white shadow-glow">
                    {settings?.logo_url ? <img src={settings.logo_url} alt={`Logo ${settings.store_name}`} className="h-full w-full object-cover" /> : <i className="fa-solid fa-store" />}
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.28em] text-saung-orange">{navItems.find((item) => item.key === tab)?.label || "Dashboard"}</p>
                    <h2 className="mt-2 text-3xl font-black text-saung-dark sm:text-4xl">{settings?.store_name || "KEDAI SAUNG BAMBU"}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-orange-950/65">Kelola operasional kedai dari satu dashboard: pesanan realtime, menu, QR meja, profil toko, dan setting pembayaran.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={requestNotificationAccess} className={`relative flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black shadow-sm transition hover:scale-[1.02] ${notificationEnabled ? "bg-emerald-600 text-white" : "bg-yellow-100 text-orange-900"}`}>
                    <i className={notificationEnabled ? "fa-solid fa-bell" : "fa-regular fa-bell"} />
                    {notificationEnabled ? "Notif Aktif" : "Aktifkan Notif"}
                    {unreadOrders ? <span className="absolute -right-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full bg-red-700 px-1 text-xs text-white ring-2 ring-white">{unreadOrders}</span> : null}
                  </button>
                  <button onClick={loadAll} disabled={loading || !!actionLoading} className="flex items-center gap-2 rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm font-black text-saung-dark shadow-sm transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-70">{loading ? <AdminSpinner /> : <i className="fa-solid fa-rotate" />} Refresh</button>
                  <Link href="/" className="rounded-2xl bg-saung-dark px-4 py-3 text-sm font-black text-white shadow-sm transition hover:scale-[1.02]">Lihat Halaman Customer</Link>
                </div>
              </div>
            </div>
          </header>

          {message ? (
            <div className="fixed bottom-5 right-5 z-[70] max-w-sm rounded-3xl border border-orange-200 bg-white p-4 text-sm font-black text-saung-red shadow-2xl">
              {message}
            </div>
          ) : null}
          {newOrderNotice ? (
            <NewOrderToast
              order={newOrderNotice}
              onClose={() => setNewOrderNotice(null)}
              onOpen={() => {
                selectTab("orders");
                setNewOrderNotice(null);
              }}
            />
          ) : null}
          {loading ? <div className="mb-5 flex items-center gap-3 rounded-3xl border border-yellow-200 bg-yellow-50 p-4 text-sm font-black text-orange-700 shadow"><AdminSpinner />Memuat data terbaru...</div> : null}
          {actionLoading ? <AdminBusyOverlay text={actionLoading} /> : null}

          {deleteTarget ? (
            <div className="fixed inset-0 z-50 grid place-items-center bg-saung-dark/60 px-4 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl">
                <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-2xl text-red-700"><i className="fa-solid fa-trash" /></div>
                <h2 className="text-2xl font-black text-saung-dark">Hapus data?</h2>
                <p className="mt-2 text-sm leading-6 text-orange-950/70">Data <b>{deleteTarget.label}</b> akan dihapus dari database. Aksi ini tidak bisa dibatalkan.</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button onClick={() => setDeleteTarget(null)} className="rounded-2xl bg-orange-50 px-5 py-3 font-black text-saung-red">Batal</button>
                  <button onClick={confirmRemove} disabled={!!actionLoading} className="flex items-center justify-center gap-2 rounded-2xl bg-red-700 px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-70">{actionLoading ? <AdminSpinner light /> : null}Ya, Hapus</button>
                </div>
              </div>
            </div>
          ) : null}

          {editor ? (
            <div className="fixed inset-0 z-50 grid place-items-center bg-saung-dark/60 px-4 py-8 backdrop-blur-sm">
              <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[2.2rem] bg-white shadow-2xl">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-orange-100 bg-white/95 p-5 backdrop-blur">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.28em] text-saung-orange">{editor.mode === "create" ? "Form Tambah" : "Form Edit"}</p>
                    <h2 className="text-2xl font-black text-saung-dark">
                      {editor.type === "product" ? (editor.mode === "create" ? "Tambah Menu Baru" : "Edit Detail Menu") : null}
                      {editor.type === "category" ? (editor.mode === "create" ? "Tambah Kategori Baru" : "Edit Kategori") : null}
                      {editor.type === "table" ? (editor.mode === "create" ? "Tambah Meja Baru" : "Edit Meja") : null}
                    </h2>
                  </div>
                  <button onClick={closeEditor} className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-50 text-xl font-black text-saung-red">×</button>
                </div>

                {editor.type === "product" ? (
                  <form onSubmit={saveProduct} className="grid gap-5 p-5 lg:grid-cols-[220px_1fr]">
                    <div className="space-y-2">
                      <div className="overflow-hidden rounded-[1.6rem] border border-orange-100 bg-orange-50">
                        {productForm.image_url ? <img src={productForm.image_url} alt="Preview menu" className="h-56 w-full object-cover" /> : <div className="grid h-56 place-items-center text-4xl text-saung-red"><i className="fa-solid fa-utensils" /></div>}
                      </div>
                      <div className="grid gap-2">
                        <label className="block cursor-pointer rounded-2xl border border-dashed border-saung-orange bg-orange-50 p-4 text-center text-sm font-black text-saung-red transition hover:bg-orange-100">
                          {actionLoading.includes("Mengupload foto menu") ? <AdminSpinner /> : <i className="fa-solid fa-upload mr-2" />}Upload foto menu
                          <input type="file" accept="image/*" onChange={(e) => uploadProductImage(e.target.files?.[0])} className="hidden" />
                        </label>
                        {productForm.image_url ? (
                          <button type="button" onClick={deleteProductImage} disabled={deletingPhoto} className="rounded-2xl bg-red-50 px-4 py-3 text-center text-sm font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60">
                            <i className="fa-solid fa-trash mr-2" />{deletingPhoto ? "Menghapus..." : "Hapus foto menu"}
                          </button>
                        ) : null}
                      </div>
                      <p className="text-xs leading-5 text-orange-950/55">Foto akan masuk ke Supabase Storage bucket <b>menu-images</b>. Tombol hapus juga menghapus file dari Storage kalau foto berasal dari upload.</p>
                    </div>
                    <div className="space-y-4">
                      <input className={inputClass()} placeholder="Nama menu" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
                      <div className="grid gap-3 md:grid-cols-2">
                        <select className={inputClass()} value={productForm.category_id} onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}>
                          <option value="">Tanpa kategori</option>
                          {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
                        <input className={inputClass()} placeholder="Badge, contoh: Best Seller" value={productForm.badge} onChange={(e) => setProductForm({ ...productForm, badge: e.target.value })} />
                      </div>
                      <textarea className={inputClass("min-h-28")} placeholder="Deskripsi" value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} />
                      <div className="grid gap-3 md:grid-cols-2">
                        <input className={inputClass()} placeholder="Harga" type="number" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} />
                        <input className={inputClass()} placeholder="Urutan" type="number" value={productForm.sort_order} onChange={(e) => setProductForm({ ...productForm, sort_order: e.target.value })} />
                      </div>
                      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                        <input className={inputClass()} placeholder="URL gambar opsional" value={productForm.image_url} onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })} />
                        {productForm.image_url ? <button type="button" onClick={deleteProductImage} disabled={deletingPhoto} className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700 disabled:opacity-60">Hapus Foto</button> : null}
                      </div>
                      <label className="flex items-center gap-3 rounded-2xl bg-orange-50 px-4 py-3 text-sm font-bold"><input type="checkbox" checked={productForm.is_available} onChange={(e) => setProductForm({ ...productForm, is_available: e.target.checked })} /> Menu tersedia</label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button type="button" onClick={closeEditor} className="rounded-2xl bg-orange-50 px-4 py-3 font-black text-saung-red">Batal</button>
                        <button disabled={!!actionLoading} className="btn-primary flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-70">{actionLoading ? <AdminSpinner light /> : null}{editor.mode === "create" ? "Tambah Menu" : "Simpan Perubahan"}</button>
                      </div>
                    </div>
                  </form>
                ) : null}

                {editor.type === "category" ? (
                  <form onSubmit={saveCategory} className="space-y-4 p-5">
                    <input className={inputClass()} placeholder="Nama kategori" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} />
                    <div className="grid gap-3 md:grid-cols-2">
                      <input className={inputClass()} placeholder="Contoh: fa-solid fa-utensils" value={categoryForm.emoji} onChange={(e) => setCategoryForm({ ...categoryForm, emoji: e.target.value })} />
                      <input className={inputClass()} type="number" placeholder="Urutan" value={categoryForm.sort_order} onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: e.target.value })} />
                    </div>
                    <label className="flex items-center gap-3 rounded-2xl bg-orange-50 px-4 py-3 text-sm font-bold"><input type="checkbox" checked={categoryForm.is_active} onChange={(e) => setCategoryForm({ ...categoryForm, is_active: e.target.checked })} /> Kategori aktif</label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button type="button" onClick={closeEditor} className="rounded-2xl bg-orange-50 px-4 py-3 font-black text-saung-red">Batal</button>
                      <button disabled={!!actionLoading} className="btn-primary flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-70">{actionLoading ? <AdminSpinner light /> : null}{editor.mode === "create" ? "Tambah Kategori" : "Simpan Perubahan"}</button>
                    </div>
                  </form>
                ) : null}

                {editor.type === "table" ? (
                  <form onSubmit={saveTable} className="space-y-4 p-5">
                    <div className="grid gap-3 md:grid-cols-2">
                      <input className={inputClass()} placeholder="Nomor meja, contoh: 1" value={tableForm.table_number} onChange={(e) => setTableForm({ ...tableForm, table_number: e.target.value })} />
                      <input className={inputClass()} placeholder="Label, contoh: Saung 1" value={tableForm.label} onChange={(e) => setTableForm({ ...tableForm, label: e.target.value })} />
                    </div>
                    <label className="flex items-center gap-3 rounded-2xl bg-orange-50 px-4 py-3 text-sm font-bold"><input type="checkbox" checked={tableForm.is_active} onChange={(e) => setTableForm({ ...tableForm, is_active: e.target.checked })} /> Meja aktif</label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button type="button" onClick={closeEditor} className="rounded-2xl bg-orange-50 px-4 py-3 font-black text-saung-red">Batal</button>
                      <button disabled={!!actionLoading} className="btn-primary flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-70">{actionLoading ? <AdminSpinner light /> : null}{editor.mode === "create" ? "Tambah Meja" : "Simpan Perubahan"}</button>
                    </div>
                  </form>
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === "dashboard" ? (
            <div className="dashboard-no-blank space-y-4">
              <section className="grid gap-4 2xl:grid-cols-[0.95fr_1.05fr]">
                <article className="rounded-[1.35rem] border border-orange-100 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-saung-orange">Ringkasan hari ini</p>
                      <h2 className="mt-2 text-3xl font-black text-saung-dark">{rupiah(stats.omzetToday)}</h2>
                      <p className="mt-1 text-xs font-semibold text-orange-950/55">{stats.ordersToday} order hari ini • {stats.pendingOrders} aktif</p>
                    </div>
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red-50 text-saung-red"><i className="fa-solid fa-cash-register" /></div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <MiniMetric label="Bulan ini" value={rupiah(stats.omzetMonth)} />
                    <MiniMetric label="Total" value={rupiah(stats.omzetAll)} />
                    <MiniMetric label="Rata-rata" value={rupiah(stats.avgTicket)} />
                  </div>
                </article>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <CompactMetric icon="fa-solid fa-calendar-days" label="Order bulan ini" value={stats.ordersMonth} note="order" />
                  <CompactMetric icon="fa-solid fa-hourglass-half" label="Belum lunas" value={stats.unpaidOrders} note="cek" />
                  <CompactMetric icon="fa-solid fa-utensils" label="Menu aktif" value={`${stats.activeProducts}/${stats.products}`} note={`${stats.categories} kategori`} />
                  <CompactMetric icon="fa-solid fa-qrcode" label="Meja QR" value={stats.tables} note="meja" />
                </div>
              </section>

              <section>
                <SalesTrendChart data={stats.dailyRevenue} />
              </section>

              <section className="rounded-[1.35rem] border border-orange-100 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-[1.35rem] border border-orange-100 bg-orange-50 text-4xl text-saung-red">
                    {settings?.logo_url ? <img src={settings.logo_url} alt={`Logo ${settings.store_name}`} className="h-full w-full object-cover" /> : <i className="fa-solid fa-store" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-saung-orange">Profil toko</p>
                    <h3 className="mt-1 truncate text-2xl font-black text-saung-dark">{settings?.store_name || "KEDAI SAUNG BAMBU"}</h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-orange-950/60">{settings?.tagline || "Logo profil akan tampil di halaman customer."}</p>
                  </div>
                  <button onClick={() => selectTab("settings")} className="shrink-0 rounded-2xl bg-saung-dark px-4 py-3 text-sm font-black text-white">
                    <i className="fa-solid fa-user-gear mr-2" />Ubah profil
                  </button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-orange-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-orange-700">Alamat</p><p className="mt-1 line-clamp-2 text-sm font-bold text-orange-950/70">{settings?.address || "Belum diisi"}</p></div>
                  <div className="rounded-2xl bg-yellow-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-yellow-700">Jam buka</p><p className="mt-1 text-sm font-bold text-orange-950/70">{settings?.opening_hours || "Belum diisi"}</p></div>
                </div>
              </section>

              <section className="rounded-[1.35rem] border border-orange-100 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-saung-orange">Monitoring</p>
                    <h3 className="text-xl font-black text-saung-dark">Pesanan terbaru</h3>
                  </div>
                  <button onClick={() => selectTab("orders")} className="rounded-2xl bg-orange-50 px-4 py-2 text-sm font-black text-saung-red">Lihat semua</button>
                </div>
                <div className="overflow-hidden rounded-[1.25rem] border border-orange-100">
                  {recentOrders.length ? recentOrders.slice(0, 4).map((order) => (
                    <div key={order.id} className="grid gap-3 border-b border-orange-100 bg-white p-3 last:border-b-0 md:grid-cols-[1fr_auto_auto] md:items-center">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider text-orange-700">#{order.order_code}</p>
                        <h4 className="font-black text-saung-dark">Meja {order.table_number || "-"} • {order.customer_name}</h4>
                        <p className="text-xs text-orange-950/55">{new Date(order.created_at).toLocaleString("id-ID")}</p>
                        <div className="mt-2"><PaymentChip order={order} /></div>
                      </div>
                      <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ring-1 ${statusBadge(order.status)}`}>{order.status}</span>
                      <b className="text-saung-red">{rupiah(order.total)}</b>
                    </div>
                  )) : <div className="p-6 text-sm font-bold text-orange-950/60">Belum ada pesanan masuk.</div>}
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <DashboardBarChart title="Status Order" description="Status pesanan saat ini." items={stats.statusSummary} />
                <DashboardBarChart title="Metode Bayar" description="Kasir, Midtrans, QRIS, dan VA." items={stats.paymentChart} />
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-[1.35rem] border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white"><i className="fa-solid fa-bell" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Notifikasi order</p>
                        <h3 className="mt-1 text-lg font-black text-saung-dark">{notificationEnabled ? "Aktif" : "Belum aktif"}</h3>
                        <p className="mt-1 text-xs leading-5 text-orange-950/60">Aktifkan supaya admin mendapat bunyi dan popup saat order masuk.</p>
                        <button onClick={requestNotificationAccess} className={`mt-3 rounded-2xl px-4 py-2.5 text-sm font-black ${notificationEnabled ? "bg-emerald-600 text-white" : "bg-saung-dark text-white"}`}>
                          <i className="fa-solid fa-bell mr-2" />{notificationEnabled ? "Notif aktif" : "Aktifkan notif"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.35rem] bg-saung-red p-4 text-white shadow-sm">
                    <p className="text-sm font-bold text-white/75">Quick action</p>
                    <h3 className="mt-1 text-xl font-black">Kelola cepat</h3>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                      <button onClick={openProductCreate} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-saung-red"><i className="fa-solid fa-plus mr-2" />Tambah Menu</button>
                      <button onClick={openTableCreate} className="rounded-2xl bg-white/15 px-4 py-3 text-sm font-black text-white"><i className="fa-solid fa-qrcode mr-2" />Tambah Meja QR</button>
                      <button onClick={() => selectTab("reports")} className="rounded-2xl bg-saung-dark px-4 py-3 text-sm font-black text-white"><i className="fa-solid fa-file-export mr-2" />Lihat Laporan</button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <BestSellerChart items={stats.bestProducts} />

                  <div className="rounded-[1.35rem] border border-orange-100 bg-white p-4 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-saung-orange">Menu</p>
                    <h3 className="text-lg font-black text-saung-dark">Menu terbaru</h3>
                    <div className="mt-3 space-y-2">
                      {latestProducts.slice(0, 4).map((product) => (
                        <div key={product.id} className="flex items-center gap-3 rounded-2xl bg-orange-50 p-3">
                          <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl bg-white text-lg">{product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" /> : <i className="fa-solid fa-utensils" />}</div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-black text-saung-dark">{product.name}</p>
                            <p className="text-xs text-orange-950/55">{rupiah(product.price)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          
{tab === "orders" ? (
            <section className="rounded-[2rem] bg-white p-5 shadow-2xl shadow-black/10">
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-saung-orange">Order Management</p>
                  <h3 className="text-2xl font-black">Pesanan Masuk</h3>
                </div>
                <button onClick={loadAll} disabled={loading || !!actionLoading} className="flex items-center justify-center gap-2 rounded-2xl bg-orange-50 px-4 py-3 text-sm font-black text-saung-red disabled:cursor-not-allowed disabled:opacity-70">{loading ? <AdminSpinner /> : <i className="fa-solid fa-rotate" />} Refresh Order</button>
              </div>
              <div className="grid gap-4">
                {orders.map((order) => (
                  <article key={order.id} className="rounded-[1.6rem] border border-orange-100 bg-white p-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-black uppercase tracking-wider text-orange-700">#{order.order_code}</p>
                          <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${statusBadge(order.status)}`}>{order.status}</span>
                          <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${statusBadge(order.payment_status)}`}>{order.payment_status}</span>
                          <PaymentChip order={order} />
                        </div>
                        <h3 className="mt-2 text-2xl font-black">Meja {order.table_number || "-"} • {order.customer_name}</h3>
                        <p className="mt-1 text-sm text-orange-950/60">{new Date(order.created_at).toLocaleString("id-ID")} • {order.customer_phone || "Tanpa nomor"}</p>
                        {order.note ? <p className="mt-2 rounded-2xl bg-white p-3 text-sm text-orange-950/75">Catatan: {order.note}</p> : null}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 xl:w-[390px]">
                        <select value={order.status} onChange={(e) => patchOrder(order.id, { status: e.target.value as Order["status"] })} className={inputClass()}>
                          {["baru", "diproses", "siap", "selesai", "dibatalkan"].map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                        <select value={order.payment_status} onChange={(e) => patchOrder(order.id, { payment_status: e.target.value as Order["payment_status"] })} className={inputClass()}>
                          {["belum_bayar", "menunggu", "lunas", "gagal", "expire", "refund"].map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <PaymentInfoCard icon="fa-solid fa-credit-card" label="Metode pembayaran" value={paymentMethodInfo(order).label} note={paymentMethodInfo(order).detail} />
                      <PaymentInfoCard icon="fa-solid fa-circle-check" label="Status pembayaran" value={order.payment_status} note={order.payment_status === "lunas" ? "Sudah masuk omzet" : "Belum lunas / perlu dicek"} />
                      <PaymentInfoCard icon="fa-solid fa-chair" label="Meja" value={order.table_number || "-"} note={order.customer_phone || "Tanpa nomor HP"} />
                    </div>
                    <div className="mt-4 grid gap-2 lg:grid-cols-2">
                      {order.order_items?.map((item) => <div key={item.id} className="flex justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm"><span>{item.quantity}× {item.product_name} {item.note ? `(${item.note})` : ""}</span><b>{rupiah(item.subtotal)}</b></div>)}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-orange-100 pt-4">
                      <p className="text-xl font-black text-saung-red">Total {rupiah(order.total)}</p>
                      <button onClick={() => remove(`/api/admin/orders/${order.id}`, `order ${order.order_code}`)} className="rounded-2xl bg-red-50 px-4 py-2 text-sm font-bold text-red-700">Hapus</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {tab === "products" ? (
            <section className="space-y-5">
              <div className="rounded-[2rem] bg-white p-5 shadow-2xl shadow-black/10">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-saung-orange">Menu CRUD</p>
                    <h3 className="text-2xl font-black">Daftar Menu</h3>
                    <p className="mt-1 text-sm text-orange-950/60">Form tambah dan edit sekarang dipisah ke modal khusus, jadi list menu tetap rapi.</p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input value={productQuery} onChange={(e) => setProductQuery(e.target.value)} className={inputClass("sm:w-72")} placeholder="Cari menu..." />
                    <button onClick={openProductCreate} className="btn-primary"><i className="fa-solid fa-plus mr-2" />Tambah Menu</button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((product) => (
                  <article key={product.id} className="overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-black/10">
                    <div className="relative h-44 bg-orange-50">
                      {product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-4xl text-saung-red"><i className="fa-solid fa-utensils" /></div>}
                      <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-saung-red shadow">{product.category?.name || "Tanpa kategori"}</div>
                      <div className={`absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-black ${product.is_available ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{product.is_available ? "Tersedia" : "Habis"}</div>
                    </div>
                    <div className="p-5">
                      <h3 className="line-clamp-1 text-xl font-black">{product.name}</h3>
                      <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-orange-950/60">{product.description || "Belum ada deskripsi."}</p>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <p className="text-xl font-black text-saung-red">{rupiah(product.price)}</p>
                        {product.badge ? <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-black text-orange-800">{product.badge}</span> : null}
                      </div>
                      <div className="mt-5 grid gap-2 sm:grid-cols-2">
                        <button onClick={() => openProductEdit(product)} className="rounded-2xl bg-saung-dark px-4 py-3 text-sm font-black text-white"><i className="fa-solid fa-pen-to-square mr-2" />Edit</button>
                        {product.image_url ? <button onClick={() => deleteSavedProductImage(product)} disabled={deletingPhoto} className="rounded-2xl bg-orange-50 px-4 py-3 text-sm font-black text-saung-red disabled:opacity-60"><i className="fa-solid fa-trash mr-2" />Hapus Foto</button> : null}
                        <button onClick={() => remove(`/api/admin/products/${product.id}`, product.name)} className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700"><i className="fa-solid fa-trash mr-2" />Hapus Menu</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {tab === "categories" ? (
            <section className="space-y-5">
              <div className="rounded-[2rem] bg-white p-5 shadow-2xl shadow-black/10">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-saung-orange">Kategori CRUD</p>
                    <h3 className="text-2xl font-black">Kategori Menu</h3>
                    <p className="mt-1 text-sm text-orange-950/60">Tambah dan edit kategori tampil di form terpisah.</p>
                  </div>
                  <button onClick={openCategoryCreate} className="btn-primary"><i className="fa-solid fa-plus mr-2" />Tambah Kategori</button>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {categories.map((cat) => (
                  <article key={cat.id} className="rounded-[2rem] bg-white p-5 shadow-2xl shadow-black/10">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-orange-50 text-2xl text-saung-red"><i className={categoryIconClass(cat.name, cat.emoji)} /></div>
                        <h3 className="text-xl font-black">{cat.name}</h3>
                        <p className="mt-1 text-sm text-orange-950/60">Urutan {cat.sort_order} • {cat.is_active ? "Aktif" : "Nonaktif"}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${cat.is_active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{cat.is_active ? "ON" : "OFF"}</span>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <button onClick={() => openCategoryEdit(cat)} className="rounded-2xl bg-saung-dark px-4 py-3 text-sm font-black text-white">Edit</button>
                      <button onClick={() => remove(`/api/admin/categories/${cat.id}`, cat.name)} className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700">Hapus</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {tab === "tables" ? (
            <section className="space-y-5">
              <div className="rounded-[2rem] bg-white p-5 shadow-2xl shadow-black/10">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-saung-orange">Table QR</p>
                    <h3 className="text-2xl font-black">Meja & QR Code</h3>
                    <p className="mt-1 text-sm text-orange-950/60">Tambah dan edit meja dibuat terpisah supaya QR list tetap bersih.</p>
                  </div>
                  <button onClick={openTableCreate} className="btn-primary"><i className="fa-solid fa-plus mr-2" />Tambah Meja</button>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {tables.map((table) => {
                  const url = `${siteUrl}/?meja=${encodeURIComponent(table.table_number)}`;
                  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}`;
                  return (
                    <article key={table.id} className="rounded-[2rem] bg-white p-5 text-center shadow-2xl shadow-black/10">
                      <div className="mx-auto w-fit rounded-[1.6rem] border border-orange-100 bg-orange-50 p-3">
                        <img src={qr} alt={`QR meja ${table.table_number}`} className="h-40 w-40 rounded-2xl bg-white p-2" />
                      </div>
                      <h3 className="mt-4 text-xl font-black">{table.label || `Meja ${table.table_number}`}</h3>
                      <p className="mt-1 break-all text-xs text-orange-950/55">{url}</p>
                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <button onClick={() => openTableEdit(table)} className="rounded-2xl bg-saung-dark px-4 py-3 text-sm font-black text-white">Edit</button>
                        <button onClick={() => remove(`/api/admin/tables/${table.id}`, table.label || `Meja ${table.table_number}`)} className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700">Hapus</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}


          {tab === "reports" ? (
            <section className="space-y-5">
              <div className="rounded-[2rem] bg-white p-5 shadow-2xl shadow-black/10">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-saung-orange">Laporan Jualan</p>
                    <h3 className="text-2xl font-black">Rekap Penjualan & Export</h3>
                    <p className="mt-1 text-sm text-orange-950/60">Filter periode, cek omzet, dan export laporan ke PDF atau Excel.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[160px_160px_auto_auto]">
                    <input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} className={inputClass()} />
                    <input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} className={inputClass()} />
                    <button onClick={exportReportPdf} className="rounded-2xl bg-saung-red px-5 py-3 text-sm font-black text-white"><i className="fa-solid fa-file-pdf mr-2" />Export PDF</button>
                    <button onClick={exportReportExcel} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white"><i className="fa-solid fa-file-excel mr-2" />Export Excel</button>
                  </div>
                </div>
              </div>

              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric icon="fa-solid fa-coins" label="Omzet Periode" value={rupiah(reportStats.revenue)} note="Order lunas + bayar kasir" accent="from-emerald-500 to-teal-400" />
                <Metric icon="fa-solid fa-receipt" label="Total Order" value={reportStats.totalOrders} note={`${reportStats.paidOrders} order terbayar`} accent="from-saung-red to-saung-orange" />
                <Metric icon="fa-solid fa-hourglass-half" label="Belum Lunas" value={reportStats.unpaidOrders} note="Menunggu pembayaran" accent="from-amber-500 to-yellow-400" />
                <Metric icon="fa-solid fa-ban" label="Dibatalkan" value={reportStats.canceledOrders} note="Order batal periode ini" accent="from-slate-800 to-slate-500" />
              </section>

              <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-black/10">
                  <div className="border-b border-orange-100 p-5">
                    <h4 className="text-xl font-black"><i className="fa-solid fa-table mr-2 text-saung-red" />Detail Order</h4>
                    <p className="mt-1 text-xs font-semibold text-orange-950/55">Data ini yang ikut ke file PDF/Excel.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] text-left text-sm">
                      <thead className="bg-saung-dark text-white">
                        <tr><th className="p-3">Tanggal</th><th className="p-3">Kode</th><th className="p-3">Meja</th><th className="p-3">Pelanggan</th><th className="p-3">Metode</th><th className="p-3">Status</th><th className="p-3 text-right">Total</th></tr>
                      </thead>
                      <tbody>
                        {reportOrders.length ? reportOrders.map((order) => (
                          <tr key={order.id} className="border-b border-orange-100 odd:bg-orange-50/70">
                            <td className="p-3 font-semibold text-orange-950/65">{new Date(order.created_at).toLocaleDateString("id-ID")}</td>
                            <td className="p-3 font-black">#{order.order_code}</td>
                            <td className="p-3">{order.table_number || "-"}</td>
                            <td className="p-3">{order.customer_name}</td>
                            <td className="p-3"><PaymentChip order={order} /></td>
                            <td className="p-3"><span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${statusBadge(order.payment_status)}`}>{order.payment_status}</span></td>
                            <td className="p-3 text-right font-black text-saung-red">{rupiah(order.total)}</td>
                          </tr>
                        )) : <tr><td colSpan={7} className="p-6 text-center font-bold text-orange-950/55">Tidak ada data pada periode ini.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-[2rem] bg-white p-5 shadow-2xl shadow-black/10">
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="text-xl font-black"><i className="fa-solid fa-trophy mr-2 text-saung-orange" />Produk Terjual</h4>
                      <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-saung-red">{reportStats.products.length} menu</span>
                    </div>
                    <div className="space-y-2">
                      {reportStats.products.length ? reportStats.products.slice(0, 10).map((item, index) => (
                        <div key={item.name} className="flex items-center justify-between rounded-2xl bg-orange-50 px-4 py-3 text-sm">
                          <span className="font-black">#{index + 1} {item.name}</span>
                          <span className="text-right"><b className="text-saung-red">{item.qty}x</b><small className="ml-2 font-bold text-orange-950/55">{rupiah(item.revenue)}</small></span>
                        </div>
                      )) : <p className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-orange-950/60">Belum ada produk terjual di periode ini.</p>}
                    </div>
                  </div>
                  <div className="rounded-[2rem] bg-white p-5 shadow-2xl shadow-black/10">
                    <h4 className="text-xl font-black"><i className="fa-solid fa-circle-info mr-2 text-saung-red" />Catatan Export</h4>
                    <p className="mt-2 text-sm leading-6 text-orange-950/65">Tombol PDF akan membuka jendela print browser. Pilih <b>Save as PDF</b>. Tombol Excel mengunduh file <b>.xls</b> yang bisa dibuka lewat Microsoft Excel atau Google Sheets.</p>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {tab === "settings" && settingsForm ? (
            <form onSubmit={saveSettings} className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
              <div className="space-y-5">
                <div className="rounded-[2rem] bg-white p-6 text-center shadow-2xl shadow-black/10">
                  <div className="mx-auto grid h-36 w-36 place-items-center overflow-hidden rounded-[2.2rem] border border-orange-100 bg-orange-50 text-6xl text-saung-red shadow-sm">
                    {settingsForm.logo_url ? <img src={settingsForm.logo_url} alt="Logo toko" className="h-full w-full object-cover" /> : <i className="fa-solid fa-store" />}
                  </div>
                  <p className="mt-5 text-xs font-black uppercase tracking-[0.25em] text-saung-orange">Preview Profil Customer</p>
                  <h3 className="mt-2 text-2xl font-black text-saung-dark">{settingsForm.store_name || "KEDAI SAUNG BAMBU"}</h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-orange-950/65">{settingsForm.tagline || "Logo profil yang kamu upload akan tampil di halaman customer dan admin."}</p>
                </div>

                <div className="rounded-[2rem] bg-white p-5 shadow-2xl shadow-black/10">
                  <h3 className="text-xl font-black">Upload Logo / Profile Toko</h3>
                  <p className="mt-1 text-sm leading-6 text-orange-950/60">Fitur banner dihapus. Sekarang tampilan customer memakai logo/profile toko saja.</p>
                  <div className="mt-4 rounded-[1.5rem] border border-orange-100 bg-orange-50/60 p-3">
                    <label className="block cursor-pointer rounded-2xl border border-dashed border-saung-orange bg-white p-4 text-sm font-black text-saung-red transition hover:bg-orange-50">
                      {actionLoading.includes("foto toko") ? <AdminSpinner /> : <i className="fa-solid fa-upload mr-2" />}Upload Logo/Profile dari File
                      <input type="file" accept="image/*" onChange={(e) => uploadSettingImage("logo_url", e.target.files?.[0])} className="hidden" />
                    </label>
                    {settingsForm.logo_url ? <button type="button" onClick={() => deleteSettingImage("logo_url", "Logo toko")} disabled={deletingPhoto} className="mt-2 w-full rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:opacity-60"><i className="fa-solid fa-trash mr-2" />Hapus Logo</button> : null}
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] bg-white p-5 shadow-2xl shadow-black/10 sm:p-6">
                <div className="mb-5">
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-saung-orange">Store Settings</p>
                  <h3 className="text-2xl font-black">Setting Toko</h3>
                  <p className="mt-1 text-sm text-orange-950/60">Bisa isi URL logo manual atau upload logo lewat file.</p>
                </div>
                <div className="space-y-4">
                  <input value={settingsForm.store_name} onChange={(e) => setSettingsForm({ ...settingsForm, store_name: e.target.value })} className={inputClass()} placeholder="Nama toko" />
                  <input value={settingsForm.tagline} onChange={(e) => setSettingsForm({ ...settingsForm, tagline: e.target.value })} className={inputClass()} placeholder="Tagline" />
                  <textarea value={settingsForm.address} onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })} className={inputClass("min-h-28")} placeholder="Alamat" />
                  <div className="grid gap-3 md:grid-cols-2">
                    <input value={settingsForm.whatsapp} onChange={(e) => setSettingsForm({ ...settingsForm, whatsapp: e.target.value })} className={inputClass()} placeholder="Nomor WhatsApp, contoh 62812..." />
                    <input value={settingsForm.opening_hours} onChange={(e) => setSettingsForm({ ...settingsForm, opening_hours: e.target.value })} className={inputClass()} placeholder="Jam buka" />
                  </div>
                  <input value={settingsForm.service_fee_percent} onChange={(e) => setSettingsForm({ ...settingsForm, service_fee_percent: e.target.value })} type="number" className={inputClass()} placeholder="Service fee %" />

                  <div className="rounded-[1.5rem] border border-orange-100 bg-orange-50/70 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-saung-dark">Logo URL</p>
                      {settingsForm.logo_url ? <button type="button" onClick={() => deleteSettingImage("logo_url", "Logo toko")} disabled={deletingPhoto} className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700 disabled:opacity-60">Hapus</button> : null}
                    </div>
                    <input value={settingsForm.logo_url} onChange={(e) => setSettingsForm({ ...settingsForm, logo_url: e.target.value })} className={inputClass()} placeholder="Logo URL opsional" />
                  </div>
                  <button disabled={!!actionLoading} className="btn-primary flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-70">{actionLoading ? <AdminSpinner light /> : null}Simpan Setting Toko</button>
                  <p className="rounded-2xl bg-orange-50 p-4 text-sm leading-6 text-orange-950/70">Password admin tetap diganti dari file <b>.env.local</b> / Vercel ENV: <b>ADMIN_PASSWORD</b>.</p>
                </div>
              </div>
            </form>
          ) : null}
        </section>
      </div>
    </main>
  );
}



function SalesTrendChart({ data }: { data: Array<{ label: string; date: string; revenue: number; orders: number }> }) {
  const width = 720;
  const height = 245;
  const paddingX = 42;
  const paddingTop = 28;
  const paddingBottom = 48;
  const maxRevenue = Math.max(1, ...data.map((item) => Number(item.revenue || 0)));
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingTop - paddingBottom;
  const points = data.map((item, index) => {
    const x = paddingX + (data.length <= 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
    const y = paddingTop + plotHeight - (Number(item.revenue || 0) / maxRevenue) * plotHeight;
    return { ...item, x, y };
  });
  const linePath = points.length ? `M ${points.map((point) => `${point.x} ${point.y}`).join(" L ")}` : "";
  const areaPath = points.length ? `${linePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z` : "";
  const totalRevenue = data.reduce((sum, item) => sum + Number(item.revenue || 0), 0);
  const totalOrders = data.reduce((sum, item) => sum + Number(item.orders || 0), 0);
  const bestDay = data.reduce((best, item) => (Number(item.revenue || 0) > Number(best.revenue || 0) ? item : best), data[0] || { label: "-", date: "-", revenue: 0, orders: 0 });

  return (
    <article className="dashboard-chart-card self-start rounded-[1.35rem] border border-orange-100 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-saung-orange">Grafik Omzet</p>
          <h3 className="mt-1 text-2xl font-black text-saung-dark">Tren 7 hari terakhir</h3>
          <p className="mt-1 text-xs font-semibold text-orange-950/55">Omzet dihitung dari order lunas dan bayar kasir.</p>
        </div>
        <div className="rounded-2xl bg-orange-50 px-4 py-3 text-right">
          <p className="text-[11px] font-black uppercase tracking-wider text-orange-950/45">Total 7 hari</p>
          <p className="text-xl font-black text-saung-red">{rupiah(totalRevenue)}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[1.4rem] border border-orange-100 bg-[#fffaf2] p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[145px] w-full" role="img" aria-label="Grafik omzet 7 hari terakhir">
          {[0, 1, 2, 3].map((line) => {
            const y = paddingTop + (line / 3) * plotHeight;
            return <line key={line} x1={paddingX} x2={width - paddingX} y1={y} y2={y} stroke="#f3dfc6" strokeWidth="2" />;
          })}
          {areaPath ? <path d={areaPath} fill="#fff1db" /> : null}
          {linePath ? <path d={linePath} fill="none" stroke="#b31222" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {points.map((point) => (
            <g key={`${point.date}-${point.label}`}>
              <circle cx={point.x} cy={point.y} r="7" fill="#b31222" />
              <circle cx={point.x} cy={point.y} r="3" fill="#ffffff" />
              <text x={point.x} y={height - 20} textAnchor="middle" className="fill-[#7a4a35] text-[13px] font-bold">{point.label}</text>
              <title>{point.date}: {rupiah(point.revenue)} • {point.orders} order</title>
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <ChartStat icon="fa-solid fa-sack-dollar" label="Omzet 7 hari" value={rupiah(totalRevenue)} />
        <ChartStat icon="fa-solid fa-receipt" label="Total order" value={`${totalOrders} order`} />
        <ChartStat icon="fa-solid fa-arrow-trend-up" label="Hari tertinggi" value={`${bestDay.label}, ${rupiah(bestDay.revenue)}`} />
      </div>
    </article>
  );
}

function DashboardBarChart({ title, description, items }: { title: string; description: string; items: Array<{ label: string; value: number; icon: string }> }) {
  const maxValue = Math.max(1, ...items.map((item) => Number(item.value || 0)));
  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);

  return (
    <article className="dashboard-chart-card self-start rounded-[1.35rem] border border-orange-100 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-saung-orange">Chart</p>
          <h3 className="mt-1 text-xl font-black text-saung-dark">{title}</h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-orange-950/55">{description}</p>
        </div>
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-50 text-saung-red"><i className="fa-solid fa-chart-simple" /></div>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const width = Math.max(6, Math.round((Number(item.value || 0) / maxValue) * 100));
          const percent = total ? Math.round((Number(item.value || 0) / total) * 100) : 0;
          return (
            <div key={item.label} className="rounded-2xl border border-orange-100 bg-[#fffaf2] p-2.5">
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 font-black text-saung-dark"><i className={`${item.icon} mr-2 text-saung-red`} />{item.label}</span>
                <span className="shrink-0 text-right font-black text-saung-red">{item.value} <small className="font-bold text-orange-950/45">({percent}%)</small></span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-orange-100">
                <div className="h-full rounded-full bg-saung-red" style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function BestSellerChart({ items }: { items: Array<{ name: string; qty: number; revenue: number }> }) {
  const maxQty = Math.max(1, ...items.map((item) => Number(item.qty || 0)));

  return (
    <article className="dashboard-chart-card self-start rounded-[1.35rem] border border-orange-100 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-saung-orange">Best Seller</p>
          <h3 className="mt-1 text-xl font-black text-saung-dark">Menu Terlaris</h3>
          <p className="mt-1 text-xs font-semibold text-orange-950/55">Berdasarkan jumlah item terjual.</p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-yellow-50 text-yellow-700"><i className="fa-solid fa-trophy" /></div>
      </div>
      <div className="space-y-2">
        {items.length ? items.map((item, index) => {
          const width = Math.max(8, Math.round((Number(item.qty || 0) / maxQty) * 100));
          return (
            <div key={item.name} className="rounded-2xl border border-orange-100 bg-[#fffaf2] p-2.5">
              <div className="mb-2 flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0 font-black text-saung-dark"><i className="fa-solid fa-ranking-star mr-2 text-saung-orange" />#{index + 1} {item.name}</span>
                <span className="shrink-0 text-right"><b className="block text-saung-red">{item.qty}x</b><small className="font-bold text-orange-950/55">{rupiah(item.revenue)}</small></span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-orange-100">
                <div className="h-full rounded-full bg-saung-red" style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        }) : <p className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-orange-950/60">Belum ada menu terjual.</p>}
      </div>
    </article>
  );
}

function ChartStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-orange-100 bg-white p-3">
      <p className="text-[11px] font-black uppercase tracking-wider text-orange-950/45"><i className={`${icon} mr-2 text-saung-red`} />{label}</p>
      <p className="mt-1 truncate text-sm font-black text-saung-dark">{value}</p>
    </div>
  );
}

function NewOrderToast({ order, onClose, onOpen }: { order: NewOrderNotice; onClose: () => void; onOpen: () => void }) {
  return (
    <div className="fixed right-4 top-4 z-[90] w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-[2rem] border border-yellow-200 bg-white shadow-2xl shadow-black/25 sm:right-6 sm:top-6">
      <div className="relative overflow-hidden bg-saung-red p-5 text-white">
        <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/20 blur-2xl" />
        <button onClick={onClose} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/15 text-lg font-black text-white hover:bg-white/25">×</button>
        <div className="relative flex items-start gap-4 pr-10">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/18 text-2xl shadow-glow">
            <i className="fa-solid fa-bell" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-100">Pesanan baru masuk</p>
            <h3 className="mt-2 text-2xl font-black leading-tight">#{order.order_code}</h3>
            <p className="mt-1 text-sm font-bold text-white/85">Meja {order.table_number || "-"} • {order.customer_name}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-3 bg-white p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-950/45">Total pesanan</p>
          <p className="mt-1 text-xl font-black text-saung-red">{rupiah(order.total)}</p>
          <p className="mt-1 text-xs font-bold text-orange-950/45">Masuk: {new Date(order.created_at).toLocaleString("id-ID")}</p>
        </div>
        <button onClick={onOpen} className="rounded-2xl bg-saung-dark px-5 py-3 text-sm font-black text-white shadow-sm transition hover:scale-[1.02]">
          <i className="fa-solid fa-eye mr-2" />Lihat Order
        </button>
      </div>
    </div>
  );
}

function AdminSpinner({ light = false, size = "h-4 w-4" }: { light?: boolean; size?: string }) {
  return <span className={`inline-block ${size} animate-spin rounded-full border-2 ${light ? "border-white/35 border-t-white" : "border-saung-red/25 border-t-saung-red"}`} />;
}

function AdminBusyOverlay({ text }: { text: string }) {
  return (
    <div className="fixed inset-0 z-[85] grid place-items-center bg-saung-dark/55 px-4 backdrop-blur-xl">
      <div className="absolute inset-0 bg-saung-dark" />
      <div className="relative w-full max-w-sm overflow-hidden rounded-[2.25rem] border border-white/70 bg-white/95 p-6 text-center text-saung-dark shadow-2xl shadow-black/35 backdrop-blur-2xl">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-saung-yellow/35 blur-2xl" />
        <div className="absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-saung-red/20 blur-2xl" />
        <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-[1.7rem] bg-saung-red shadow-glow">
          <AdminSpinner light size="h-9 w-9" />
        </div>
        <p className="relative mt-5 text-xs font-black uppercase tracking-[0.28em] text-saung-orange">Sedang proses</p>
        <h3 className="relative mt-2 text-2xl font-black leading-tight">{text}</h3>
        <div className="relative mt-6 h-2 overflow-hidden rounded-full bg-orange-100">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-saung-red" />
        </div>
        <p className="relative mt-3 text-xs font-bold text-orange-950/45">Jangan tutup halaman sampai proses selesai.</p>
      </div>
    </div>
  );
}

function PaymentChip({ order }: { order: Order }) {
  const info = paymentMethodInfo(order);
  return (
    <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-black ring-1 ${info.tone}`}>
      <i className={info.icon} />
      {info.label}
    </span>
  );
}

function PaymentInfoCard({ icon, label, value, note }: { icon: string; label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded-[1.35rem] border border-orange-100 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-orange-50 text-saung-red"><i className={icon} /></div>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-950/45">{label}</p>
          <h4 className="mt-1 truncate text-sm font-black text-saung-dark">{value}</h4>
          {note ? <p className="mt-1 truncate text-xs text-orange-950/50">{note}</p> : null}
        </div>
      </div>
    </div>
  );
}


function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-orange-100 bg-[#fffaf2] px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-wider text-orange-950/45">{label}</p>
      <p className="mt-0.5 truncate text-sm font-black text-saung-dark">{value}</p>
    </div>
  );
}

function CompactMetric({ icon, label, value, note }: { icon: string; label: string; value: string | number; note: string }) {
  return (
    <article className="rounded-[1.15rem] border border-orange-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-black text-orange-950/55">{label}</p>
          <div className="mt-1 flex items-end gap-2">
            <h3 className="truncate text-2xl font-black leading-none text-saung-dark">{value}</h3>
            <span className="mb-0.5 truncate text-[11px] font-bold text-orange-950/45">{note}</span>
          </div>
        </div>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-saung-red"><i className={icon} /></div>
      </div>
    </article>
  );
}

function Metric({ icon, label, value, note, accent }: { icon: string; label: string; value: string | number; note: string; accent: string }) {
  return (
    <article className="overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-black/10">
      <div className="h-2 bg-saung-red" />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-orange-950/55">{label}</p>
            <h2 className="mt-2 text-2xl font-black text-saung-dark sm:text-3xl">{value}</h2>
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-50 text-xl text-saung-red"><i className={icon} /></div>
        </div>
        <p className="mt-3 text-sm text-orange-950/55">{note}</p>
      </div>
    </article>
  );
}
