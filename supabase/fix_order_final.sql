-- FINAL FIX ORDER KEDAI SAUNG BAMBU
-- Jalankan file ini di Supabase SQL Editor kalau checkout/order gagal dibuat.
-- Aman dijalankan berkali-kali.

-- 1) Pastikan semua kolom pembayaran yang dipakai kode terbaru ada.
alter table public.orders add column if not exists payment_type text;
alter table public.orders add column if not exists payment_channel text;
alter table public.orders add column if not exists payment_reference text;
alter table public.orders add column if not exists midtrans_order_id text;
alter table public.orders add column if not exists midtrans_transaction_id text;
alter table public.orders add column if not exists midtrans_snap_token text;
alter table public.orders add column if not exists midtrans_redirect_url text;

create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_midtrans_order_id_idx on public.orders(midtrans_order_id);

-- 2) Isi default untuk order lama.
update public.orders
set
  payment_type = case
    when payment_type is not null then payment_type
    when payment_method = 'cash' then 'cash'
    else 'midtrans'
  end,
  payment_channel = case
    when payment_channel is not null then payment_channel
    when payment_method = 'cash' then 'cash'
    else null
  end
where payment_type is null or payment_channel is null;

-- 3) Pastikan RLS aktif. API website wajib memakai service_role key untuk insert/update.
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- 4) Reload schema cache Supabase/PostgREST.
notify pgrst, 'reload schema';
