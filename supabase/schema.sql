-- Jalankan file ini di Supabase SQL Editor.
-- Project: KEDAI SAUNG BAMBU - QR Menu + Admin + Midtrans

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  emoji text default '🍽️',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists categories_updated_at on public.categories;
create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text unique not null,
  description text,
  price integer not null default 0 check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  image_url text,
  badge text,
  is_available boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();

create table if not exists public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  table_number text unique not null,
  label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists dining_tables_updated_at on public.dining_tables;
create trigger dining_tables_updated_at before update on public.dining_tables for each row execute function public.set_updated_at();

create table if not exists public.store_settings (
  id int primary key default 1 check (id = 1),
  store_name text not null default 'KEDAI SAUNG BAMBU',
  tagline text,
  address text,
  whatsapp text,
  service_fee_percent numeric(5,2) not null default 0,
  opening_hours text,
  logo_url text,
  hero_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists store_settings_updated_at on public.store_settings;
create trigger store_settings_updated_at before update on public.store_settings for each row execute function public.set_updated_at();

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text unique not null,
  table_number text,
  customer_name text not null,
  customer_phone text,
  note text,
  subtotal integer not null default 0 check (subtotal >= 0),
  service_fee integer not null default 0 check (service_fee >= 0),
  total integer not null default 0 check (total >= 0),
  status text not null default 'baru' check (status in ('baru', 'diproses', 'siap', 'selesai', 'dibatalkan')),
  payment_status text not null default 'belum_bayar' check (payment_status in ('belum_bayar', 'menunggu', 'lunas', 'gagal', 'expire', 'refund')),
  payment_method text not null default 'cash' check (payment_method in ('cash', 'midtrans')),
  payment_type text,
  payment_channel text,
  payment_reference text,
  midtrans_order_id text,
  midtrans_transaction_id text,
  midtrans_snap_token text,
  midtrans_redirect_url text,
  stock_restored boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_midtrans_order_id_idx on public.orders(midtrans_order_id);

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  price integer not null default 0 check (price >= 0),
  quantity integer not null default 1 check (quantity > 0),
  subtotal integer not null default 0 check (subtotal >= 0),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items(order_id);

-- Sistem stok produk.
-- Stok berkurang otomatis saat order berhasil dibuat.
create or replace function public.decrement_product_stock(p_product_id uuid, p_quantity int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count int;
begin
  if p_quantity <= 0 then
    return false;
  end if;

  update public.products
  set stock = stock - p_quantity,
      updated_at = now()
  where id = p_product_id
    and is_available = true
    and stock >= p_quantity;

  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

-- Dipakai untuk rollback stok kalau proses order gagal di tengah jalan.
create or replace function public.increase_product_stock(p_product_id uuid, p_quantity int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_quantity <= 0 then
    return false;
  end if;

  update public.products
  set stock = stock + p_quantity,
      updated_at = now()
  where id = p_product_id;

  return true;
end;
$$;

-- Mengembalikan stok kalau order dibatalkan/gagal/expired/refund.
create or replace function public.restore_order_stock(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  already_restored boolean;
begin
  select stock_restored
  into already_restored
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    return false;
  end if;

  if already_restored then
    return true;
  end if;

  update public.products p
  set stock = p.stock + oi.quantity,
      updated_at = now()
  from public.order_items oi
  where oi.order_id = p_order_id
    and oi.product_id = p.id;

  update public.orders
  set stock_restored = true,
      updated_at = now()
  where id = p_order_id;

  return true;
end;
$$;


-- Storage bucket untuk foto menu.
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do update set public = true;

-- Row Level Security: public hanya boleh baca menu/toko/meja aktif.
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.dining_tables enable row level security;
alter table public.store_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Public read active categories" on public.categories;
create policy "Public read active categories" on public.categories for select using (is_active = true);

drop policy if exists "Public read available products" on public.products;
create policy "Public read available products" on public.products for select using (is_available = true);

drop policy if exists "Public read active tables" on public.dining_tables;
create policy "Public read active tables" on public.dining_tables for select using (is_active = true);

drop policy if exists "Public read settings" on public.store_settings;
create policy "Public read settings" on public.store_settings for select using (true);

-- Admin API memakai Service Role Key, jadi policy insert/update/delete tidak perlu dibuka ke publik.
-- Jangan taruh SUPABASE_SERVICE_ROLE_KEY di frontend.
