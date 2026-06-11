-- Jalankan file ini di Supabase SQL Editor kalau database kamu sudah dibuat dari versi sebelumnya.
-- Fungsinya menambahkan detail metode pembayaran yang dipilih customer di Midtrans.

alter table public.orders add column if not exists payment_type text;
alter table public.orders add column if not exists payment_channel text;
alter table public.orders add column if not exists payment_reference text;

-- Isi default untuk order lama supaya dashboard langsung punya label pembayaran.
update public.orders
set payment_type = case when payment_method = 'cash' then 'cash' else coalesce(payment_type, 'midtrans') end
where payment_type is null;
