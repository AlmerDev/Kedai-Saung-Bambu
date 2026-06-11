# PANDUAN CLIENT
# KEDAI SAUNG BAMBU

Dokumen ini untuk client atau pembeli source code.

## Isi Paket

Paket source code ini berisi:

```txt
1. Source code website QR menu
2. Admin panel
3. API order dan payment
4. File database Supabase
5. File contoh environment variable
6. Panduan setup lengkap
7. Panduan penggunaan admin
```

## Yang Perlu Disiapkan Client

```txt
1. Akun Supabase
2. Akun Vercel
3. Akun Midtrans jika ingin pembayaran online
4. Domain pribadi jika ingin pakai domain custom
```

## Cara Menjalankan Singkat

```bash
npm install
npm run dev
```

Buka:

```txt
http://localhost:3000
```

Admin:

```txt
http://localhost:3000/admin
```

## Cara Setup Database

Di Supabase SQL Editor, jalankan:

```txt
1. supabase/schema.sql
2. supabase/seed.sql
```

File lain di folder `_optional_legacy_fix` tidak wajib untuk instalasi baru.

## Login Admin

Password admin diatur melalui file `.env.local`:

```env
ADMIN_PASSWORD=admin123
```

Ganti password sebelum website dipakai production.

## Fitur Admin

Admin bisa:

```txt
- Melihat dashboard
- Melihat pesanan masuk
- Mengubah status pesanan
- Menambah menu
- Mengedit menu
- Menghapus menu
- Menambah kategori
- Mengatur meja QR
- Export laporan PDF/Excel
- Mengubah profil toko
- Mengupload logo toko
```

## Pembayaran

Project mendukung:

```txt
- Bayar kasir
- Midtrans
- QRIS/VA/e-wallet melalui Midtrans sesuai aktivasi akun
```

Untuk Midtrans production, client harus mengaktifkan akun Midtrans production sendiri.

## Batasan Paket Source Code

Source code ini belum termasuk:

```txt
- Domain
- Biaya transaksi Midtrans
- Biaya layanan pihak ketiga
- Maintenance bulanan
- Custom fitur tambahan di luar paket
```

Kecuali ada kesepakatan berbeda antara penjual dan client.

## Catatan Penting

File `.env.local` tidak boleh disebarkan publik. Service role key Supabase dan server key Midtrans harus disimpan aman.


## Update Fitur Stok

Sistem stok menu sudah aktif. Admin bisa mengisi stok saat tambah/edit menu. Setiap order berhasil dibuat, stok produk otomatis berkurang. Jika stok 0, tombol beli di halaman pelanggan akan terkunci dan checkout ditolak oleh server.

Untuk database lama, jalankan file opsional:

```txt
supabase/_optional_legacy_fix/add_product_stock_system.sql
```
