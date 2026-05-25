-- Fix untuk error checkout/pembayaran:
-- - Gagal membuat order
-- - Could not find payment_type/payment_channel/midtrans_snap_token
-- Jalankan di Supabase SQL Editor, lalu tunggu 10-30 detik.

alter table public.orders add column if not exists payment_type text;
alter table public.orders add column if not exists payment_channel text;
alter table public.orders add column if not exists payment_reference text;
alter table public.orders add column if not exists midtrans_snap_token text;
alter table public.orders add column if not exists midtrans_redirect_url text;
alter table public.orders add column if not exists midtrans_order_id text;
alter table public.orders add column if not exists midtrans_transaction_id text;

create index if not exists orders_midtrans_order_id_idx on public.orders(midtrans_order_id);

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

-- Pastikan service role bisa bypass RLS. Public tetap tidak dibuka untuk insert/update/delete.
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

notify pgrst, 'reload schema';
