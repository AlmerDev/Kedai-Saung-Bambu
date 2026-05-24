"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Category, DiningTable, Order, Product, StoreSettings } from "@/lib/types";
import { rupiah } from "@/lib/format";

type Tab = "dashboard" | "orders" | "products" | "categories" | "tables" | "settings";
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
const emptyCategory: CategoryForm = { name: "", emoji: "🍽️", sort_order: "0", is_active: true };
const emptyTable: TableForm = { table_number: "", label: "", is_active: true };

const navItems: { key: Tab; label: string; icon: string; desc: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "fa-solid fa-chart-line", desc: "Ringkasan usaha" },
  { key: "orders", label: "Pesanan", icon: "fa-solid fa-receipt", desc: "Order masuk" },
  { key: "products", label: "Menu", icon: "fa-solid fa-utensils", desc: "Makanan & minuman" },
  { key: "categories", label: "Kategori", icon: "fa-solid fa-layer-group", desc: "Kelompok menu" },
  { key: "tables", label: "Meja & QR", icon: "fa-solid fa-qrcode", desc: "QR tiap meja" },
  { key: "settings", label: "Setting", icon: "fa-solid fa-gear", desc: "Profil kedai" }
];

function inputClass(extra = "") {
  return `w-full rounded-2xl border border-orange-200 bg-white/95 px-4 py-3 text-sm font-semibold text-saung-dark outline-none transition placeholder:text-orange-950/35 focus:border-saung-orange focus:ring-4 focus:ring-orange-100 ${extra}`;
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
  const [editor, setEditor] = useState<EditorState>(null);
  const [productQuery, setProductQuery] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState<SettingsForm | null>(null);

  const [productForm, setProductForm] = useState<ProductForm>(emptyProduct);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategory);
  const [tableForm, setTableForm] = useState<TableForm>(emptyTable);
  const [deleteTarget, setDeleteTarget] = useState<{ path: string; label: string } | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState(false);

  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

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
      setOrders(orderRes.orders);
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
    checkAuth();
  }, []);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayOrders = orders.filter((order) => new Date(order.created_at).toDateString() === today);
    const paidOrders = todayOrders.filter((order) => order.payment_status === "lunas" || order.payment_method === "cash");
    return {
      products: products.length,
      activeProducts: products.filter((item) => item.is_available).length,
      categories: categories.length,
      tables: tables.length,
      ordersToday: todayOrders.length,
      omzetToday: paidOrders.reduce((sum, order) => sum + order.total, 0),
      pendingOrders: orders.filter((order) => ["baru", "diproses"].includes(order.status)).length,
      unpaidOrders: orders.filter((order) => ["belum_bayar", "menunggu"].includes(order.payment_status)).length,
      cashOrdersToday: todayOrders.filter((order) => order.payment_method === "cash").length,
      midtransOrdersToday: todayOrders.filter((order) => order.payment_method === "midtrans").length,
      paidMidtransToday: todayOrders.filter((order) => order.payment_method === "midtrans" && order.payment_status === "lunas").length,
      waitingMidtransToday: todayOrders.filter((order) => order.payment_method === "midtrans" && order.payment_status === "menunggu").length
    };
  }, [orders, products, categories, tables]);

  const filteredProducts = useMemo(() => {
    const keyword = productQuery.trim().toLowerCase();
    if (!keyword) return products;
    return products.filter((product) => [product.name, product.description, product.category?.name, product.badge].join(" ").toLowerCase().includes(keyword));
  }, [products, productQuery]);

  const recentOrders = orders.slice(0, 6);
  const latestProducts = products.slice(0, 5);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) });
      setAuthenticated(true);
      await loadAll();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Login gagal.");
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    setAuthenticated(false);
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
    setCategoryForm({ id: category.id, name: category.name, emoji: category.emoji || "🍽️", sort_order: String(category.sort_order || 0), is_active: category.is_active });
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
    try {
      const body = JSON.stringify({ ...categoryForm, sort_order: Number(categoryForm.sort_order || 0) });
      if (categoryForm.id) await api(`/api/admin/categories/${categoryForm.id}`, { method: "PATCH", body });
      else await api("/api/admin/categories", { method: "POST", body });
      closeEditor();
      await loadAll();
      notify(categoryForm.id ? "Kategori berhasil diperbarui." : "Kategori baru berhasil ditambahkan.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal simpan kategori.");
    }
  }

  async function saveTable(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    try {
      const body = JSON.stringify(tableForm);
      if (tableForm.id) await api(`/api/admin/tables/${tableForm.id}`, { method: "PATCH", body });
      else await api("/api/admin/tables", { method: "POST", body });
      closeEditor();
      await loadAll();
      notify(tableForm.id ? "Meja berhasil diperbarui." : "Meja baru berhasil ditambahkan.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal simpan meja.");
    }
  }

  async function saveProduct(e: FormEvent) {
    e.preventDefault();
    setMessage("");
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
    }
  }

  async function uploadFile(file?: File, folder = "menu") {
    if (!file) return "";
    setMessage("Mengupload gambar...");
    const form = new FormData();
    form.append("file", file);
    form.append("folder", folder);
    const response = await fetch("/api/admin/upload", { method: "POST", body: form });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Upload gagal.");
    notify("Gambar berhasil diupload.");
    return String(payload.url || "");
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
    }
  }

  async function deleteSavedProductImage(product: Product) {
    if (!product.image_url || deletingPhoto) return;
    setDeletingPhoto(true);
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
    }
  }

  async function deleteSettingImage(field: "logo_url" | "hero_image_url", label: string) {
    if (!settingsForm?.[field] || deletingPhoto) return;
    setDeletingPhoto(true);
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
    }
  }

  async function saveSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!settingsForm) return;
    setMessage("");
    try {
      await api("/api/admin/settings", { method: "PATCH", body: JSON.stringify(settingsForm) });
      await loadAll();
      notify("Setting toko berhasil disimpan.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal simpan setting.");
    }
  }

  async function patchOrder(id: string, payload: Partial<Order>) {
    setMessage("");
    try {
      await api(`/api/admin/orders/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
      await loadAll();
      notify("Status order berhasil diperbarui.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal update order.");
    }
  }

  function remove(path: string, label: string) {
    setDeleteTarget({ path, label });
  }

  async function confirmRemove() {
    if (!deleteTarget) return;
    try {
      await api(deleteTarget.path, { method: "DELETE" });
      await loadAll();
      notify(`${deleteTarget.label} berhasil dihapus.`);
      setDeleteTarget(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal hapus data.");
    }
  }

  if (authenticated === null) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#190908] px-4">
        <div className="rounded-[2rem] border border-white/10 bg-white/10 px-6 py-5 font-black text-white shadow-2xl backdrop-blur">Memuat admin...</div>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#190908] px-4 py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,209,102,0.26),transparent_34rem),radial-gradient(circle_at_80%_10%,rgba(249,115,22,0.23),transparent_28rem),linear-gradient(135deg,#190908,#3a0c0b_55%,#7a1014)]" />
        <div className="absolute inset-0 opacity-30 food-dots" />
        <form onSubmit={handleLogin} className="relative w-full max-w-md rounded-[2.5rem] border border-white/15 bg-white/10 p-8 text-white shadow-2xl backdrop-blur-2xl">
          <div className="mb-7 flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-saung-yellow to-saung-orange text-3xl shadow-glow">🎋</div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-saung-yellow">Admin Panel</p>
              <h1 className="text-2xl font-black">KEDAI SAUNG BAMBU</h1>
            </div>
          </div>
          <p className="mb-5 text-sm leading-6 text-white/70">Masuk untuk mengatur dashboard, pesanan, menu, QR meja, foto toko, dan pembayaran.</p>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="w-full rounded-2xl border border-white/15 bg-white/90 px-4 py-4 text-sm font-bold text-saung-dark outline-none placeholder:text-orange-950/40 focus:ring-4 focus:ring-saung-yellow/30" placeholder="Password admin" />
          {message ? <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{message}</p> : null}
          <button className="mt-5 w-full rounded-2xl bg-gradient-to-r from-saung-red via-saung-orange to-saung-yellow px-5 py-4 font-black text-white shadow-glow transition hover:scale-[1.02] active:scale-[0.98]">Masuk Admin</button>
          <Link href="/" className="mt-5 block text-center text-sm font-bold text-saung-yellow">← Kembali ke menu pelanggan</Link>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#170908] text-saung-dark">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(255,209,102,0.18),transparent_30rem),radial-gradient(circle_at_90%_20%,rgba(249,115,22,0.16),transparent_26rem),linear-gradient(135deg,#170908,#2b0c0a_45%,#4b100c)]" />
      <div className="relative grid min-h-screen lg:grid-cols-[300px_1fr]">
        <aside className="border-b border-white/10 bg-white/10 p-4 text-white backdrop-blur-2xl lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:p-5">
          <div className="flex items-center gap-4 rounded-[2rem] border border-white/10 bg-white/10 p-4 shadow-2xl">
            <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-saung-yellow to-saung-orange text-2xl shadow-glow">
              {settings?.logo_url ? <img src={settings.logo_url} alt={`Logo ${settings.store_name}`} className="h-full w-full object-cover" /> : "🎋"}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-saung-yellow">Admin Suite</p>
              <h1 className="truncate text-lg font-black">{settings?.store_name || "Saung Bambu"}</h1>
            </div>
          </div>

          <nav className="no-scrollbar mt-4 flex gap-3 overflow-x-auto lg:grid lg:overflow-visible">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`flex min-w-[170px] items-center gap-3 rounded-2xl px-4 py-3 text-left transition lg:min-w-0 ${tab === item.key ? "bg-gradient-to-r from-saung-red to-saung-orange text-white shadow-glow" : "bg-white/10 text-white/72 hover:bg-white/20 hover:text-white"}`}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/14 text-lg"><i className={item.icon} /></span>
                <span>
                  <span className="block text-sm font-black">{item.label}</span>
                  <span className="block text-xs text-white/55">{item.desc}</span>
                </span>
              </button>
            ))}
          </nav>

          <div className="mt-5 hidden rounded-[2rem] border border-white/10 bg-white/10 p-4 lg:block">
            <p className="text-sm font-black text-white">Status toko</p>
            <div className="mt-3 space-y-2 text-sm text-white/65">
              <p className="flex justify-between"><span>Menu aktif</span><b className="text-white">{stats.activeProducts}</b></p>
              <p className="flex justify-between"><span>Order aktif</span><b className="text-saung-yellow">{stats.pendingOrders}</b></p>
              <p className="flex justify-between"><span>Meja</span><b className="text-white">{stats.tables}</b></p>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <Link href="/" className="flex-1 rounded-2xl bg-white/10 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-white/15"><i className="fa-solid fa-store mr-2" />Menu</Link>
            <button onClick={logout} className="rounded-2xl bg-red-500/20 px-4 py-3 text-sm font-black text-red-100 transition hover:bg-red-500/30"><i className="fa-solid fa-right-from-bracket mr-2" />Logout</button>
          </div>
        </aside>

        <section className="min-w-0 p-4 sm:p-6 lg:p-8">
          <header className="mb-6 overflow-hidden rounded-[2.2rem] border border-white/10 bg-white shadow-2xl shadow-black/20">
            <div className="relative p-6 sm:p-7">
              {settings?.hero_image_url ? <img src={settings.hero_image_url} alt={`Banner ${settings.store_name}`} className="absolute inset-0 h-full w-full object-cover" /> : null}
              <div className={`absolute inset-0 ${settings?.hero_image_url ? "bg-gradient-to-r from-white via-white/92 to-white/72" : "bg-white/95"}`} />
              <div className="absolute right-0 top-0 h-40 w-40 rounded-bl-[5rem] bg-gradient-to-br from-saung-yellow/50 to-saung-orange/30 blur-2xl" />
              <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-3xl bg-gradient-to-br from-saung-red to-saung-orange text-3xl text-white shadow-glow">
                    {settings?.logo_url ? <img src={settings.logo_url} alt={`Logo ${settings.store_name}`} className="h-full w-full object-cover" /> : "🎋"}
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.28em] text-saung-orange">{navItems.find((item) => item.key === tab)?.label || "Dashboard"}</p>
                    <h2 className="mt-2 text-3xl font-black text-saung-dark sm:text-4xl">{settings?.store_name || "KEDAI SAUNG BAMBU"}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-orange-950/65">Kelola operasional kedai dari satu dashboard: pesanan realtime, menu, QR meja, foto toko, dan setting pembayaran.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={loadAll} className="rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm font-black text-saung-dark shadow-sm transition hover:bg-orange-50">↻ Refresh</button>
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
          {loading ? <div className="mb-5 rounded-3xl border border-yellow-200 bg-yellow-50 p-4 text-sm font-black text-orange-700 shadow">Memuat data terbaru...</div> : null}

          {deleteTarget ? (
            <div className="fixed inset-0 z-50 grid place-items-center bg-saung-dark/60 px-4 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl">
                <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-3xl">🗑️</div>
                <h2 className="text-2xl font-black text-saung-dark">Hapus data?</h2>
                <p className="mt-2 text-sm leading-6 text-orange-950/70">Data <b>{deleteTarget.label}</b> akan dihapus dari database. Aksi ini tidak bisa dibatalkan.</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button onClick={() => setDeleteTarget(null)} className="rounded-2xl bg-orange-50 px-5 py-3 font-black text-saung-red">Batal</button>
                  <button onClick={confirmRemove} className="rounded-2xl bg-red-700 px-5 py-3 font-black text-white">Ya, Hapus</button>
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
                    <div className="space-y-3">
                      <div className="overflow-hidden rounded-[1.6rem] border border-orange-100 bg-orange-50">
                        {productForm.image_url ? <img src={productForm.image_url} alt="Preview menu" className="h-56 w-full object-cover" /> : <div className="grid h-56 place-items-center text-6xl">🍽️</div>}
                      </div>
                      <div className="grid gap-2">
                        <label className="block cursor-pointer rounded-2xl border border-dashed border-saung-orange bg-orange-50 p-4 text-center text-sm font-black text-saung-red transition hover:bg-orange-100">
                          <i className="fa-solid fa-upload mr-2" />Upload foto menu
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
                          {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</option>)}
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
                        <button className="btn-primary">{editor.mode === "create" ? "Tambah Menu" : "Simpan Perubahan"}</button>
                      </div>
                    </div>
                  </form>
                ) : null}

                {editor.type === "category" ? (
                  <form onSubmit={saveCategory} className="space-y-4 p-5">
                    <input className={inputClass()} placeholder="Nama kategori" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} />
                    <div className="grid gap-3 md:grid-cols-2">
                      <input className={inputClass()} placeholder="Emoji" value={categoryForm.emoji} onChange={(e) => setCategoryForm({ ...categoryForm, emoji: e.target.value })} />
                      <input className={inputClass()} type="number" placeholder="Urutan" value={categoryForm.sort_order} onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: e.target.value })} />
                    </div>
                    <label className="flex items-center gap-3 rounded-2xl bg-orange-50 px-4 py-3 text-sm font-bold"><input type="checkbox" checked={categoryForm.is_active} onChange={(e) => setCategoryForm({ ...categoryForm, is_active: e.target.checked })} /> Kategori aktif</label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button type="button" onClick={closeEditor} className="rounded-2xl bg-orange-50 px-4 py-3 font-black text-saung-red">Batal</button>
                      <button className="btn-primary">{editor.mode === "create" ? "Tambah Kategori" : "Simpan Perubahan"}</button>
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
                      <button className="btn-primary">{editor.mode === "create" ? "Tambah Meja" : "Simpan Perubahan"}</button>
                    </div>
                  </form>
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === "dashboard" ? (
            <div className="space-y-6">
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric icon="fa-solid fa-coins" label="Omzet Hari Ini" value={rupiah(stats.omzetToday)} note="Cash + pembayaran lunas" accent="from-emerald-500 to-teal-400" />
                <Metric icon="fa-solid fa-receipt" label="Order Hari Ini" value={stats.ordersToday} note={`${stats.pendingOrders} order aktif`} accent="from-saung-red to-saung-orange" />
                <Metric icon="fa-solid fa-utensils" label="Menu Aktif" value={`${stats.activeProducts}/${stats.products}`} note={`${stats.categories} kategori`} accent="from-orange-500 to-yellow-400" />
                <Metric icon="fa-solid fa-qrcode" label="Meja QR" value={stats.tables} note={`${stats.unpaidOrders} order belum lunas`} accent="from-slate-800 to-slate-500" />
              </section>

              <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
                <div className="space-y-6">
                  <div className="overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-black/10">
                    <div className="relative h-52 bg-gradient-to-br from-saung-red via-saung-orange to-saung-yellow">
                      {settings?.hero_image_url ? <img src={settings.hero_image_url} alt={`Banner ${settings.store_name}`} className="absolute inset-0 h-full w-full object-cover" /> : null}
                      <div className="absolute inset-0 bg-gradient-to-t from-saung-dark/80 via-saung-dark/25 to-transparent" />
                      <div className="absolute bottom-5 left-5 right-5 flex items-end gap-4 text-white">
                        <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-3xl border border-white/30 bg-white/90 text-4xl shadow-2xl">
                          {settings?.logo_url ? <img src={settings.logo_url} alt={`Logo ${settings.store_name}`} className="h-full w-full object-cover" /> : "🎋"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase tracking-[0.25em] text-saung-yellow">Profil Toko Aktif</p>
                          <h3 className="truncate text-3xl font-black">{settings?.store_name || "KEDAI SAUNG BAMBU"}</h3>
                          <p className="truncate text-sm text-white/75">{settings?.tagline || "Logo dan banner akan tampil di halaman customer."}</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-3 p-5 md:grid-cols-3">
                      <div className="rounded-2xl bg-orange-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-orange-700">Alamat</p><p className="mt-1 line-clamp-2 text-sm font-bold text-orange-950/70">{settings?.address || "Belum diisi"}</p></div>
                      <div className="rounded-2xl bg-yellow-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-yellow-700">Jam Buka</p><p className="mt-1 text-sm font-bold text-orange-950/70">{settings?.opening_hours || "Belum diisi"}</p></div>
                      <button onClick={() => setTab("settings")} className="rounded-2xl bg-saung-dark p-4 text-left text-sm font-black text-white"><i className="fa-solid fa-image mr-2" />Ubah logo/banner</button>
                    </div>
                  </div>

                  <div className="rounded-[2rem] bg-white p-5 shadow-2xl shadow-black/10">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.25em] text-saung-orange">Monitoring</p>
                      <h3 className="text-2xl font-black text-saung-dark">Pesanan Terbaru</h3>
                    </div>
                    <button onClick={() => setTab("orders")} className="rounded-2xl bg-orange-50 px-4 py-2 text-sm font-black text-saung-red">Lihat semua</button>
                  </div>
                  <div className="overflow-hidden rounded-[1.5rem] border border-orange-100">
                    {recentOrders.length ? recentOrders.map((order) => (
                      <div key={order.id} className="grid gap-3 border-b border-orange-100 bg-white p-4 last:border-b-0 md:grid-cols-[1fr_auto_auto] md:items-center">
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
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-[2rem] bg-gradient-to-br from-saung-red via-saung-orange to-saung-yellow p-5 text-white shadow-glow">
                    <p className="text-sm font-bold text-white/75">Quick Action</p>
                    <h3 className="mt-1 text-2xl font-black">Kelola lebih cepat</h3>
                    <div className="mt-5 grid gap-3">
                      <button onClick={openProductCreate} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-saung-red"><i className="fa-solid fa-plus mr-2" />Tambah Menu</button>
                      <button onClick={openTableCreate} className="rounded-2xl bg-white/20 px-4 py-3 text-sm font-black text-white backdrop-blur"><i className="fa-solid fa-qrcode mr-2" />Tambah Meja QR</button>
                      <button onClick={() => setTab("settings")} className="rounded-2xl bg-saung-dark px-4 py-3 text-sm font-black text-white"><i className="fa-solid fa-image mr-2" />Atur Foto Toko</button>
                    </div>
                  </div>

                  <div className="rounded-[2rem] bg-white p-5 shadow-2xl shadow-black/10">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.25em] text-saung-orange">Payment</p>
                        <h3 className="text-xl font-black text-saung-dark">Ringkasan Pembayaran</h3>
                      </div>
                      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700"><i className="fa-solid fa-credit-card" /></div>
                    </div>
                    <div className="grid gap-3">
                      <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 text-sm"><span><i className="fa-solid fa-money-bill-wave mr-2 text-emerald-700" />Bayar kasir hari ini</span><b className="text-emerald-700">{stats.cashOrdersToday}</b></div>
                      <div className="flex items-center justify-between rounded-2xl bg-blue-50 px-4 py-3 text-sm"><span><i className="fa-solid fa-globe mr-2 text-blue-700" />Midtrans hari ini</span><b className="text-blue-700">{stats.midtransOrdersToday}</b></div>
                      <div className="flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-3 text-sm"><span><i className="fa-solid fa-clock mr-2 text-amber-700" />Midtrans menunggu</span><b className="text-amber-700">{stats.waitingMidtransToday}</b></div>
                    </div>
                  </div>

                  <div className="rounded-[2rem] bg-white p-5 shadow-2xl shadow-black/10">
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-saung-orange">Menu</p>
                    <h3 className="text-xl font-black text-saung-dark">Menu terbaru</h3>
                    <div className="mt-4 space-y-3">
                      {latestProducts.map((product) => (
                        <div key={product.id} className="flex items-center gap-3 rounded-2xl bg-orange-50 p-3">
                          <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-white text-xl">{product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" /> : "🍽️"}</div>
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
                <button onClick={loadAll} className="rounded-2xl bg-orange-50 px-4 py-3 text-sm font-black text-saung-red">Refresh Order</button>
              </div>
              <div className="grid gap-4">
                {orders.map((order) => (
                  <article key={order.id} className="rounded-[1.6rem] border border-orange-100 bg-gradient-to-br from-white to-orange-50/45 p-4">
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
                      {product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-6xl">🍽️</div>}
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
                        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-orange-50 text-3xl">{cat.emoji || "🍽️"}</div>
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

          {tab === "settings" && settingsForm ? (
            <form onSubmit={saveSettings} className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
              <div className="space-y-5">
                <div className="overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-black/10">
                  <div className="relative h-60 bg-orange-100">
                    {settingsForm.hero_image_url ? <img src={settingsForm.hero_image_url} alt="Preview banner toko" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center bg-gradient-to-br from-saung-red via-saung-orange to-saung-yellow text-6xl">🎋</div>}
                    <div className="absolute inset-0 bg-gradient-to-t from-saung-dark/70 via-saung-dark/10 to-transparent" />
                    <div className="absolute bottom-5 left-5 right-5 flex items-end gap-4 text-white">
                      <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-3xl border border-white/30 bg-white/90 text-4xl shadow-2xl">
                        {settingsForm.logo_url ? <img src={settingsForm.logo_url} alt="Logo toko" className="h-full w-full object-cover" /> : "🎋"}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-2xl font-black">{settingsForm.store_name || "KEDAI SAUNG BAMBU"}</h3>
                        <p className="truncate text-sm text-white/75">{settingsForm.tagline || "Menu warkop hangat dan nyaman"}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-saung-orange">Preview Customer</p>
                    <p className="mt-2 text-sm leading-6 text-orange-950/65">Foto logo dan banner yang kamu upload di sini akan dipakai untuk tampilan luar/customer page setelah setting disimpan.</p>
                  </div>
                </div>

                <div className="rounded-[2rem] bg-white p-5 shadow-2xl shadow-black/10">
                  <h3 className="text-xl font-black">Upload Foto Toko</h3>
                  <p className="mt-1 text-sm leading-6 text-orange-950/60">Logo dan banner bisa diupload ulang atau dihapus langsung dari Storage.</p>
                  <div className="mt-4 grid gap-3">
                    <div className="rounded-[1.5rem] border border-orange-100 bg-orange-50/60 p-3">
                      <label className="block cursor-pointer rounded-2xl border border-dashed border-saung-orange bg-white p-4 text-sm font-black text-saung-red transition hover:bg-orange-50">
                        <i className="fa-solid fa-upload mr-2" />Upload Logo dari File
                        <input type="file" accept="image/*" onChange={(e) => uploadSettingImage("logo_url", e.target.files?.[0])} className="hidden" />
                      </label>
                      {settingsForm.logo_url ? <button type="button" onClick={() => deleteSettingImage("logo_url", "Logo toko")} disabled={deletingPhoto} className="mt-2 w-full rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:opacity-60"><i className="fa-solid fa-trash mr-2" />Hapus Logo</button> : null}
                    </div>
                    <div className="rounded-[1.5rem] border border-orange-100 bg-orange-50/60 p-3">
                      <label className="block cursor-pointer rounded-2xl border border-dashed border-saung-orange bg-white p-4 text-sm font-black text-saung-red transition hover:bg-orange-50">
                        <i className="fa-solid fa-upload mr-2" />Upload Banner/Hero dari File
                        <input type="file" accept="image/*" onChange={(e) => uploadSettingImage("hero_image_url", e.target.files?.[0])} className="hidden" />
                      </label>
                      {settingsForm.hero_image_url ? <button type="button" onClick={() => deleteSettingImage("hero_image_url", "Banner toko")} disabled={deletingPhoto} className="mt-2 w-full rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:opacity-60"><i className="fa-solid fa-trash mr-2" />Hapus Banner</button> : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] bg-white p-5 shadow-2xl shadow-black/10 sm:p-6">
                <div className="mb-5">
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-saung-orange">Store Settings</p>
                  <h3 className="text-2xl font-black">Setting Toko</h3>
                  <p className="mt-1 text-sm text-orange-950/60">Bisa isi URL manual atau upload foto lewat file.</p>
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
                  <div className="rounded-[1.5rem] border border-orange-100 bg-orange-50/70 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-saung-dark">Banner/Hero URL</p>
                      {settingsForm.hero_image_url ? <button type="button" onClick={() => deleteSettingImage("hero_image_url", "Banner toko")} disabled={deletingPhoto} className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700 disabled:opacity-60">Hapus</button> : null}
                    </div>
                    <input value={settingsForm.hero_image_url} onChange={(e) => setSettingsForm({ ...settingsForm, hero_image_url: e.target.value })} className={inputClass()} placeholder="Hero image URL opsional" />
                  </div>
                  <button className="btn-primary w-full">Simpan Setting Toko</button>
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

function Metric({ icon, label, value, note, accent }: { icon: string; label: string; value: string | number; note: string; accent: string }) {
  return (
    <article className="overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-black/10">
      <div className={`h-2 bg-gradient-to-r ${accent}`} />
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
