-- Jalankan file ini kalau database kamu sudah pernah dibuat dari versi sebelumnya.
-- Fungsinya menambah kolom penyimpanan token/link Midtrans agar pembayaran bisa diulang
-- ketika customer tidak sengaja menutup popup Midtrans sebelum membayar.

alter table public.orders add column if not exists midtrans_snap_token text;
alter table public.orders add column if not exists midtrans_redirect_url text;
