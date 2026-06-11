export type Category = {
  id: string;
  name: string;
  slug: string;
  emoji: string | null;
  sort_order: number;
  is_active: boolean;
};

export type Product = {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  badge: string | null;
  is_available: boolean;
  sort_order: number;
  category?: Category | null;
};

export type DiningTable = {
  id: string;
  table_number: string;
  label: string | null;
  is_active: boolean;
};

export type StoreSettings = {
  id: number;
  store_name: string;
  tagline: string | null;
  address: string | null;
  whatsapp: string | null;
  service_fee_percent: number;
  opening_hours: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
};

export type OrderStatus = "baru" | "diproses" | "siap" | "selesai" | "dibatalkan";
export type PaymentStatus = "belum_bayar" | "menunggu" | "lunas" | "gagal" | "expire" | "refund";
export type PaymentMethod = "cash" | "midtrans";

export type OrderItem = {
  id?: string;
  order_id?: string;
  product_id: string | null;
  product_name: string;
  price: number;
  quantity: number;
  subtotal: number;
  note: string | null;
};

export type Order = {
  id: string;
  order_code: string;
  table_number: string | null;
  customer_name: string;
  customer_phone: string | null;
  note: string | null;
  subtotal: number;
  service_fee: number;
  total: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  payment_type?: string | null;
  payment_channel?: string | null;
  payment_reference?: string | null;
  midtrans_order_id: string | null;
  midtrans_transaction_id: string | null;
  midtrans_snap_token?: string | null;
  midtrans_redirect_url?: string | null;
  created_at: string;
  updated_at: string;
  stock_restored?: boolean;
  order_items?: OrderItem[];
};

export type CartItem = {
  product_id: string;
  quantity: number;
  note?: string;
};
