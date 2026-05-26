# KEDAI SAUNG BAMBU - QR Menu + Admin + Supabase + Midtrans

Website lengkap untuk kedai/warkop:

- Customer scan QR meja dan buka menu.
- Customer pilih menu, masuk keranjang, checkout.
- Admin panel untuk CRUD menu, kategori, meja, pesanan, dan setting toko.
- Database online memakai Supabase.
- Upload foto menu ke Supabase Storage.
- Pembayaran online via Midtrans Snap.
- Siap deploy ke Vercel.

---

## 1. Install lokal

```bash
npm install
npm run dev
```

Buka:

```txt
http://localhost:3000
http://localhost:3000/admin
http://localhost:3000/?meja=1
```

---

## 2. Buat database Supabase

1. Buka Supabase.
2. Buat project baru.
3. Masuk ke **SQL Editor**.
4. Jalankan file:

```txt
supabase/schema.sql
```

5. Setelah itu jalankan:

```txt
supabase/seed.sql
```

File `schema.sql` membuat tabel:

```txt
categories
products
dining_tables
orders
order_items
store_settings
storage bucket: menu-images
```

File `seed.sql` mengisi data awal:

```txt
KEDAI SAUNG BAMBU
Kategori menu
Ayam bakar
Ayam goreng
Minuman
Kopi
Makanan ringan
Meja 1-12
```

---

## 3. Isi ENV lokal

Copy file `.env.example`, lalu buat file baru:

```txt
.env.local
```

Isi seperti ini:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=isi_service_role_key_dari_supabase

ADMIN_PASSWORD=admin123
SESSION_SECRET=ganti_dengan_random_panjang_minimal_32_karakter

MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxxxxxxxxxx
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxxxxxxxxxx
MIDTRANS_IS_PRODUCTION=false
NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=false

NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Ambil Supabase ENV dari mana?

Di Supabase:

```txt
Project Settings > API
```

Ambil:

```txt
Project URL -> NEXT_PUBLIC_SUPABASE_URL
service_role key -> SUPABASE_SERVICE_ROLE_KEY
```

PENTING: `SUPABASE_SERVICE_ROLE_KEY` jangan dimasukkan ke frontend dan jangan di-share publik.

---

## 4. Login admin

Default dari ENV:

```txt
/admin
Password: admin123
```

Ganti password dari `.env.local`:

```env
ADMIN_PASSWORD=password_baru_kamu
```

Kalau deploy di Vercel, ganti dari Environment Variables.

---

## 5. Midtrans Sandbox

Isi ENV ini:

```env
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxx
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxx
MIDTRANS_IS_PRODUCTION=false
NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=false
```

Server key dipakai di backend `/api/midtrans/create-transaction`.
Client key dipakai di frontend untuk Snap popup.

Notification URL / webhook Midtrans:

```txt
https://domain-kamu.vercel.app/api/midtrans/notification
```

Finish redirect URL otomatis memakai:

```env
NEXT_PUBLIC_SITE_URL
```

---

## 6. Deploy ke Vercel

1. Upload project ke GitHub.
2. Buka Vercel.
3. Import repository.
4. Framework: Next.js.
5. Tambahkan Environment Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=isi_service_role_key_dari_supabase
ADMIN_PASSWORD=password_baru_kamu
SESSION_SECRET=random_panjang_minimal_32_karakter
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxx
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxx
MIDTRANS_IS_PRODUCTION=false
NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=false
NEXT_PUBLIC_SITE_URL=https://nama-project.vercel.app
```

6. Deploy.

Setelah deploy, masuk admin:

```txt
https://nama-project.vercel.app/admin
```

---

## 7. QR meja

Masuk admin:

```txt
/admin > Meja & QR
```

QR otomatis mengarah ke:

```txt
https://domain-kamu.vercel.app/?meja=1
https://domain-kamu.vercel.app/?meja=2
```

Download/screenshot QR, lalu tempel di meja.

---

## 8. Catatan penting

- Versi ini sudah pakai database online Supabase.
- Admin CRUD tersimpan di database.
- Order customer masuk ke database dan bisa dilihat dari admin.
- Pembayaran Midtrans sandbox bisa dites kalau key sudah diisi.
- Untuk transaksi asli, ganti key Midtrans production dan ubah ENV production ke `true`.
- Midtrans asli tetap kena fee per transaksi sukses.


## Update Dashboard Elegan

Versi ini sudah memperbarui tampilan admin:

- Dashboard admin dibuat lebih profesional dengan sidebar, metric card, monitoring pesanan terbaru, dan quick action.
- Form tambah dan edit untuk menu, kategori, dan meja dibuat terpisah dalam modal khusus.
- Setting toko mendukung upload logo dan banner/hero dari file ke Supabase Storage.
- Upload file setting tetap menggunakan bucket `menu-images`, dengan folder `settings/`.


## Update Pembayaran Otomatis + Bayar Lagi

Versi ini sudah menambahkan alur pembayaran yang lebih aman:

- Kalau Midtrans mengirim status `settlement` atau `capture + fraud_status accept`, order otomatis menjadi `payment_status = lunas` dan `status = diproses`.
- Kalau status `pending`, order tetap `payment_status = menunggu`.
- Kalau status `deny`, `cancel`, `failure`, atau `expire`, order otomatis ditandai gagal/expire dan status pesanan dibatalkan.
- Customer yang tidak sengaja menutup popup Midtrans bisa klik tombol **Bayar Lagi** tanpa membuat pesanan baru.
- Token dan link pembayaran Midtrans disimpan di kolom `midtrans_snap_token` dan `midtrans_redirect_url`.
- Saat customer kembali dari halaman Midtrans lewat `?order=...`, website akan mengecek ulang status pembayaran ke Midtrans.

Kalau database kamu sudah dibuat dari versi lama, jalankan migration ini di Supabase SQL Editor:

```txt
supabase/migration_auto_payment_retry.sql
```

Kalau kamu membuat database baru dari awal, cukup jalankan `schema.sql` dan `seed.sql` seperti biasa.

## Update Dashboard Payment Method + Font Awesome

Versi ini menambahkan detail metode pembayaran di dashboard admin:

- Order cash tampil sebagai **Bayar di Kasir**.
- Order Midtrans tampil sesuai metode yang dipilih customer, misalnya **QRIS**, **GoPay**, **Virtual Account BCA/BNI/BRI**, **ShopeePay**, **Kartu Kredit**, atau **Convenience Store**.
- Dashboard admin menampilkan ringkasan pembayaran hari ini.
- Halaman Pesanan menampilkan kartu detail metode pembayaran, status pembayaran, meja, dan nomor pelanggan.
- Icon admin memakai Font Awesome CDN.

Kalau database kamu sudah dibuat dari versi sebelumnya, jalankan migration tambahan ini di Supabase SQL Editor:

```txt
supabase/migration_payment_method_detail.sql
```

Kalau kamu membuat database baru dari awal, cukup jalankan `schema.sql` lalu `seed.sql`.

## Update Hapus Foto Upload

Versi ini menambahkan fitur hapus foto yang sudah diupload:

- Foto menu bisa dihapus dari form edit menu.
- Foto menu juga bisa dihapus langsung dari card daftar menu.
- Logo toko bisa dihapus dari halaman Setting.
- Banner/Hero toko bisa dihapus dari halaman Setting.
- Kalau foto berasal dari Supabase Storage bucket `menu-images`, file-nya ikut dihapus dari Storage.
- Kalau gambar berasal dari URL eksternal/manual, URL-nya dihapus dari data/form, tetapi file eksternal tidak ikut terhapus.
- Saat menu dihapus, foto menu yang tersimpan di Supabase Storage juga ikut dibersihkan supaya tidak menumpuk.

Tidak perlu migration database baru untuk update ini.

## Update: Notifikasi Pesanan Baru Admin

Versi ini menambahkan fitur notifikasi pesanan baru di halaman `/admin`:

- Admin otomatis mengecek order baru setiap ±7 detik selama halaman admin terbuka.
- Saat order baru masuk, muncul toast "Pesanan baru masuk" di kanan atas dashboard.
- Ada badge jumlah order baru di tombol Pesanan.
- Tombol "Aktifkan Notif" di dashboard/header bisa mengaktifkan bunyi dan notifikasi browser.
- Tidak perlu migration database baru untuk fitur ini.

Catatan: notifikasi browser dan bunyi hanya aktif selama halaman admin terbuka. Browser juga perlu diberi izin notifikasi.
