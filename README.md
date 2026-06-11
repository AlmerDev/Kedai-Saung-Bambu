# KEDAI SAUNG BAMBU
## QR Menu + Admin Panel + Supabase + Midtrans

Source code siap pakai untuk sistem QR menu restoran/kedai/warkop.

## Fitur Utama

- QR menu per meja.
- Halaman customer untuk pilih menu dan checkout.
- Admin panel.
- CRUD menu, kategori, meja QR, dan pesanan.
- Upload foto menu dan logo/profil toko.
- Dashboard admin dengan chart omzet/status/metode bayar.
- Notifikasi order masuk untuk admin.
- Pembayaran kasir dan Midtrans.
- Retry pembayaran jika popup Midtrans tertutup.
- Status pembayaran otomatis via webhook Midtrans.
- Laporan penjualan.
- Export laporan PDF/Excel.
- Deploy ready ke Vercel.
- Database Supabase.

## Instalasi Cepat

```bash
npm install
npm run dev
```

Website:

```txt
http://localhost:3000
```

Admin:

```txt
http://localhost:3000/admin
```

## Database

Untuk Supabase baru, jalankan:

```txt
supabase/schema.sql
supabase/seed.sql
```

Jangan jalankan file di folder `_optional_legacy_fix` kecuali update dari versi lama atau ada error tertentu.

## Environment Variable

Copy `.env.example` menjadi `.env.local`, lalu isi Supabase URL, Service Role Key, Midtrans Key, dan password admin.

## Panduan Lengkap

Baca file:

```txt
PANDUAN_SETUP_LENGKAP.md
PANDUAN_CLIENT.md
```

## Catatan Keamanan

Jangan upload/share file `.env.local`.

Jangan share:

```txt
SUPABASE_SERVICE_ROLE_KEY
MIDTRANS_SERVER_KEY
SESSION_SECRET
ADMIN_PASSWORD production
```
