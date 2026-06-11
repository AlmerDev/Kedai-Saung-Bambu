-- Jalankan kalau pembayaran hanya jalan di meja tertentu atau kolom pembayaran belum lengkap.
-- Aman dijalankan berkali-kali.

alter table public.orders add column if not exists payment_type text;
alter table public.orders add column if not exists payment_channel text;
alter table public.orders add column if not exists payment_reference text;
alter table public.orders add column if not exists midtrans_snap_token text;
alter table public.orders add column if not exists midtrans_redirect_url text;

-- Pastikan meja 1-12 ada dan aktif. Ubah angka 12 sesuai jumlah meja kamu.
insert into public.dining_tables (table_number, label, is_active)
select n::text, 'Meja ' || n::text, true
from generate_series(1, 12) as n
on conflict (table_number) do update set
  label = excluded.label,
  is_active = true;

update public.orders
set payment_type = case
  when payment_method = 'cash' then 'cash'
  else coalesce(payment_type, 'midtrans')
end
where payment_type is null;

notify pgrst, 'reload schema';
