# Supabase SQL

Untuk instalasi baru / database kosong, jalankan hanya:

```txt
1. schema.sql
2. seed.sql
```

## Penjelasan

`schema.sql` membuat tabel, index, trigger, policy, dan storage bucket yang dibutuhkan aplikasi.

`seed.sql` mengisi data awal seperti kategori, menu contoh, meja QR, dan profil toko default.

## Folder `_optional_legacy_fix`

Folder ini hanya untuk update dari database versi lama atau kalau terjadi error kolom/order/payment.

Untuk client baru, folder `_optional_legacy_fix` boleh diabaikan.
