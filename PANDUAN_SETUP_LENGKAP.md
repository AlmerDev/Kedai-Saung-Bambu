# PANDUAN SETUP LENGKAP
# KEDAI SAUNG BAMBU — QR Menu, Admin Panel, Supabase, Midtrans, Vercel

Dokumen ini dibuat untuk membantu install project dari nol sampai siap online.

Project ini berisi:
- Website customer untuk scan QR meja dan pesan menu.
- Admin panel untuk kelola menu, kategori, meja QR, pesanan, laporan, dan profil toko.
- Database Supabase.
- Upload foto menu/logo toko.
- Pembayaran kasir dan Midtrans.
- Notifikasi order masuk.
- Dashboard admin dengan chart.
- Export laporan PDF/Excel.

---

## 1. Kebutuhan Awal

Sebelum mulai, install dulu:

1. Node.js versi LTS atau terbaru.
2. VS Code.
3. Akun Supabase.
4. Akun Vercel.
5. Akun Midtrans kalau mau fitur pembayaran online.
6. Git, kalau mau deploy lewat GitHub/Vercel.

Cek Node.js:

```bash
node -v
npm -v
```

Kalau muncul versi, berarti sudah siap.

---

## 2. Struktur Folder Penting

Di dalam project ini, file pentingnya:

```txt
app/                         Halaman website dan API route Next.js
app/admin/page.tsx           Halaman admin
app/page.tsx                 Halaman customer
app/api/                     API untuk order, payment, upload, admin, dll

lib/                         Helper Supabase, format rupiah, dan type data
public/                      Asset publik
supabase/                    File database SQL
.env.example                 Contoh environment variable
package.json                 Daftar script dan dependency
```

Folder Supabase berisi:

```txt
supabase/schema.sql
supabase/seed.sql
supabase/_optional_legacy_fix/migration_auto_payment_retry.sql
supabase/_optional_legacy_fix/migration_payment_method_detail.sql
supabase/_optional_legacy_fix/fix_midtrans_tables.sql
supabase/_optional_legacy_fix/fix_checkout_orders.sql
supabase/_optional_legacy_fix/fix_order_final.sql
```

---

## 3. File SQL Supabase Yang Dipakai

### Kalau database masih kosong / project Supabase baru

Jalankan cukup ini:

```txt
1. supabase/schema.sql
2. supabase/seed.sql
```

`schema.sql` adalah file utama untuk membuat tabel, storage bucket, trigger, index, dan policy.

`seed.sql` adalah data awal seperti menu contoh, kategori, meja QR, dan setting toko.

### Kalau database sudah pernah dibuat dari versi lama

Jalankan file tambahan ini setelah `schema.sql` / di database lama:

```txt
1. supabase/migration_auto_payment_retry.sql
2. supabase/migration_payment_method_detail.sql
3. supabase/fix_midtrans_tables.sql
4. supabase/fix_checkout_orders.sql
5. supabase/fix_order_final.sql
```

File tambahan ini gunanya untuk memperbaiki atau menambah kolom pembayaran/order dari versi lama.

### Urutan aman untuk project baru

Untuk project baru, jalankan seperti ini:

```txt
WAJIB:
1. schema.sql
2. seed.sql

OPSIONAL / hanya kalau error atau database lama:
3. migration_auto_payment_retry.sql
4. migration_payment_method_detail.sql
5. fix_midtrans_tables.sql
6. fix_checkout_orders.sql
7. fix_order_final.sql
```

---

## 4. Cara Setup Supabase Dari Nol

### 4.1 Buat Project Supabase

1. Masuk ke Supabase.
2. Klik `New Project`.
3. Isi nama project, contoh:

```txt
kedai-saung-bambu
```

4. Buat password database.
5. Pilih region terdekat, misalnya Singapore.
6. Tunggu project selesai dibuat.

---

### 4.2 Jalankan Schema

1. Buka Supabase Dashboard.
2. Masuk ke menu `SQL Editor`.
3. Klik `New Query`.
4. Buka file:

```txt
supabase/schema.sql
```

5. Copy semua isi file.
6. Paste ke SQL Editor.
7. Klik `Run`.

Kalau berhasil, tabel akan muncul di `Table Editor`.

---

### 4.3 Jalankan Seed Data

Setelah `schema.sql` berhasil:

1. Buka file:

```txt
supabase/seed.sql
```

2. Copy semua isinya.
3. Paste ke SQL Editor.
4. Klik `Run`.

Setelah berhasil, data awal seperti menu, kategori, meja, dan setting toko akan muncul.

---

### 4.4 Tabel Yang Akan Dibuat

Umumnya tabel yang dibuat:

```txt
categories
products
dining_tables
store_settings
orders
order_items
```

Storage bucket yang dibuat:

```txt
menu-images
```

Bucket ini dipakai untuk upload foto menu/logo toko.

---

## 5. Ambil Supabase URL dan Service Role Key

Masuk ke:

```txt
Supabase Dashboard → Project Settings → API
```

Ambil:

```txt
Project URL
Service Role Key / Secret Key
```

Contoh format:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=isi_service_role_key_dari_supabase
```

Penting:

```txt
SUPABASE_SERVICE_ROLE_KEY jangan pernah ditaruh di frontend.
Jangan pernah share service role key ke orang publik.
Jangan pakai anon key untuk SUPABASE_SERVICE_ROLE_KEY.
```

Kalau salah isi key, biasanya muncul error seperti:

```txt
permission denied for table orders
new row violates row-level security policy
Gagal membuat order
```

---

## 6. Setup ENV Local

Di folder project, buat file baru:

```txt
.env.local
```

Isi seperti ini:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=isi_service_role_key_dari_supabase

# Admin panel
ADMIN_PASSWORD=admin123
SESSION_SECRET=ganti_dengan_random_panjang_minimal_32_karakter

# Midtrans Sandbox
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxxxxxxxxxx
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxxxxxxxxxx
MIDTRANS_IS_PRODUCTION=false
NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=false

# URL website local
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Contoh `SESSION_SECRET`:

```txt
kedai-saung-bambu-rahasia-2026-random-panjang
```

Untuk production, ganti dengan random yang lebih panjang.

---

## 7. Jalankan Project Di Localhost

Buka terminal di folder project.

Install dependency:

```bash
npm install
```

Jalankan website:

```bash
npm run dev
```

Buka di browser:

```txt
http://localhost:3000
```

Admin:

```txt
http://localhost:3000/admin
```

Login admin menggunakan password dari `.env.local`:

```txt
ADMIN_PASSWORD=admin123
```

---

## 8. Cara Menggunakan Admin Panel

Di admin panel tersedia:

```txt
Dashboard      Ringkasan omzet, order, chart, dan monitoring
Pesanan        Melihat dan mengubah status pesanan
Menu           Tambah/edit/hapus menu
Kategori       Tambah/edit/hapus kategori
Meja & QR      Tambah meja dan ambil QR per meja
Laporan        Rekap penjualan dan export PDF/Excel
Setting        Ubah nama toko, tagline, alamat, jam buka, logo
```

---

## 9. Cara Membuat QR Meja

1. Masuk admin.
2. Buka menu `Meja & QR`.
3. Tambahkan nomor meja, contoh:

```txt
1
2
3
```

4. Ambil link/QR meja.
5. Print QR.
6. Tempel di meja.

Format URL customer biasanya:

```txt
https://domain-kamu.com?table=1
```

atau sesuai link QR yang dibuat di admin.

---

## 10. Setup Midtrans Sandbox

Midtrans dipakai untuk pembayaran online.

### 10.1 Ambil Key Midtrans

Masuk dashboard Midtrans.

Pilih mode:

```txt
Sandbox
```

Ambil:

```txt
Server Key
Client Key
```

Masukkan ke `.env.local`:

```env
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxxxxxxxxxx
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxxxxxxxxxx
MIDTRANS_IS_PRODUCTION=false
NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=false
```

Untuk local testing, gunakan sandbox dulu.

---

### 10.2 Webhook Midtrans

Webhook dipakai supaya status pembayaran otomatis update.

Kalau sudah deploy, URL webhook-nya:

```txt
https://domain-kamu.com/api/midtrans/notification
```

Masukkan URL itu di dashboard Midtrans.

Biasanya masuk ke:

```txt
Settings → Payment → Notification URL
```

atau menu konfigurasi notifikasi di dashboard Midtrans.

---

### 10.3 Mode Production Midtrans

Kalau sudah mau transaksi asli:

```env
MIDTRANS_IS_PRODUCTION=true
NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=true
```

Lalu ganti key sandbox menjadi key production:

```env
MIDTRANS_SERVER_KEY=Mid-server-xxxxxxxx
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=Mid-client-xxxxxxxx
```

Jangan campur key sandbox dan production.

---

## 11. Deploy Ke Vercel

### 11.1 Upload Project Ke GitHub

Di terminal:

```bash
git init
git add .
git commit -m "initial kedai saung bambu"
```

Buat repo GitHub, lalu connect:

```bash
git remote add origin https://github.com/username/nama-repo.git
git branch -M main
git push -u origin main
```

---

### 11.2 Import Ke Vercel

1. Masuk Vercel.
2. Klik `Add New Project`.
3. Pilih repo GitHub.
4. Framework biasanya otomatis terdeteksi sebagai Next.js.
5. Jangan lupa isi Environment Variables.

---

### 11.3 Environment Variables Di Vercel

Masukkan semua ENV ini ke Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=isi_service_role_key_dari_supabase

ADMIN_PASSWORD=admin123
SESSION_SECRET=ganti_dengan_random_panjang_minimal_32_karakter

MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxxxxxxxxxx
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxxxxxxxxxx
MIDTRANS_IS_PRODUCTION=false
NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=false

NEXT_PUBLIC_SITE_URL=https://domain-vercel-kamu.vercel.app
```

Penting:

```txt
Di Vercel, NEXT_PUBLIC_SITE_URL jangan localhost.
Harus pakai URL website yang sudah online.
```

Contoh:

```env
NEXT_PUBLIC_SITE_URL=https://kedai-saung-bambu.vercel.app
```

Setelah ubah ENV di Vercel, lakukan redeploy.

---

## 12. Perintah Build

Untuk test build local:

```bash
npm run build
```

Kalau berhasil, jalankan production mode:

```bash
npm run start
```

Untuk development:

```bash
npm run dev
```

---

## 13. Cara Update Project Lama Dengan ZIP Baru

Kalau sebelumnya sudah ada project lama yang sudah terhubung Git/Vercel:

1. Extract ZIP baru.
2. Copy isi ZIP baru ke folder project lama.
3. Jangan hapus file ini:

```txt
.env.local
.git
```

4. Jalankan:

```bash
npm install
npm run build
npm run dev
```

5. Kalau sudah aman:

```bash
git add .
git commit -m "update kedai saung bambu"
git push
```

Vercel akan otomatis deploy ulang kalau repo sudah connect.

---

## 14. Troubleshooting Error Umum

### Error: permission denied for table orders

Penyebab:

```txt
SUPABASE_SERVICE_ROLE_KEY salah
pakai anon key
RLS menolak request
```

Solusi:

```txt
Ambil service role key dari Supabase Project Settings → API.
Masukkan ke SUPABASE_SERVICE_ROLE_KEY.
Jangan pakai NEXT_PUBLIC untuk service role.
Restart server.
```

---

### Error: new row violates row-level security policy

Penyebab:

```txt
API tidak memakai service role key
.env.local salah
server belum restart setelah ENV diganti
```

Solusi:

```bash
CTRL + C
npm run dev
```

Lalu cek lagi `.env.local`.

---

### Error: payment_type column not found

Penyebab:

```txt
Database masih versi lama.
Kolom pembayaran belum ada.
```

Solusi:

Jalankan SQL tambahan:

```txt
supabase/migration_payment_method_detail.sql
supabase/fix_checkout_orders.sql
supabase/fix_order_final.sql
```

Atau kalau project baru, jalankan ulang `schema.sql` yang terbaru di database kosong.

---

### Error: Gagal membuat order

Cek:

```txt
1. Supabase URL benar
2. Service Role Key benar
3. schema.sql sudah dijalankan
4. seed.sql sudah dijalankan
5. .env.local sudah dibuat
6. server sudah direstart
```

---

### Error: Midtrans popup tidak muncul

Cek:

```txt
1. NEXT_PUBLIC_MIDTRANS_CLIENT_KEY benar
2. MIDTRANS_SERVER_KEY benar
3. MIDTRANS_IS_PRODUCTION sesuai mode key
4. Browser tidak memblokir popup
5. NEXT_PUBLIC_SITE_URL benar
```

Kalau di production, pastikan webhook:

```txt
https://domain-kamu.com/api/midtrans/notification
```

sudah diset di Midtrans.

---

### Error: NEXT_PUBLIC_SITE_URL masih localhost di Vercel

Solusi:

Di Vercel Environment Variables, ubah:

```env
NEXT_PUBLIC_SITE_URL=https://domain-vercel-kamu.vercel.app
```

Lalu redeploy.

---

### Error: npm install gagal / timeout

Solusi:

```bash
npm cache clean --force
npm install
```

Kalau masih gagal, ganti koneksi internet atau coba ulang beberapa menit kemudian.

---

## 15. Checklist Sebelum Dikasih Ke Client

Pastikan:

```txt
[ ] Project bisa npm install
[ ] Project bisa npm run dev
[ ] Supabase schema.sql sudah dijalankan
[ ] Supabase seed.sql sudah dijalankan
[ ] .env.local sudah benar
[ ] Admin bisa login
[ ] Menu bisa tambah/edit/hapus
[ ] Foto bisa upload
[ ] QR meja bisa dibuka
[ ] Customer bisa checkout
[ ] Pesanan masuk ke admin
[ ] Midtrans sandbox bisa dibuka
[ ] Webhook Midtrans sudah diset
[ ] Deploy Vercel berhasil
[ ] NEXT_PUBLIC_SITE_URL sudah pakai domain online
[ ] Laporan PDF/Excel bisa dipakai
```

---

## 16. File Yang Jangan Disebar Publik

Jangan share file ini ke publik:

```txt
.env.local
```

Jangan share value ini ke publik:

```txt
SUPABASE_SERVICE_ROLE_KEY
MIDTRANS_SERVER_KEY
SESSION_SECRET
ADMIN_PASSWORD production
```

Yang boleh dikasih sebagai contoh:

```txt
.env.example
```

---

## 17. Catatan Untuk Jual Source Code

Kalau source code dijual ke client, sebaiknya paket berisi:

```txt
1. Source code ZIP
2. Supabase schema.sql
3. Supabase seed.sql
4. Panduan setup ini
5. .env.example
6. Catatan login admin
```

Jelaskan juga batasan:

```txt
Harga belum termasuk domain.
Harga belum termasuk biaya transaksi Midtrans.
Harga belum termasuk maintenance bulanan kecuali disepakati.
Source code boleh/tidak boleh dijual ulang sesuai perjanjian.
```

---

## 18. Ringkasan Cepat Instalasi

Untuk project baru:

```txt
1. Buat Supabase project
2. Jalankan supabase/schema.sql
3. Jalankan supabase/seed.sql
4. Buat .env.local
5. Isi Supabase URL dan Service Role Key
6. Isi Midtrans key kalau dipakai
7. npm install
8. npm run dev
9. Login /admin
10. Deploy ke Vercel
11. Isi ENV di Vercel
12. Set webhook Midtrans
```

Selesai.
