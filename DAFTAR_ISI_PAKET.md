# DAFTAR ISI PAKET SIAP JUAL

```txt
README.md
PANDUAN_SETUP_LENGKAP.md
PANDUAN_CLIENT.md
CATATAN_PENJUAL.md
SYARAT_PENGGUNAAN_SOURCE_CODE.md
.env.example
supabase/schema.sql
supabase/seed.sql
supabase/README_SUPABASE.md
supabase/_optional_legacy_fix/
app/
lib/
public/
package.json
```

Status:

```txt
✅ Source code final
✅ Database utama dirapikan
✅ Setup guide lengkap
✅ Client handover guide tersedia
✅ ENV example tersedia
✅ File rahasia tidak disertakan
✅ Siap dikirim ke client
```


## Update Fitur Stok

Sistem stok menu sudah aktif. Admin bisa mengisi stok saat tambah/edit menu. Setiap order berhasil dibuat, stok produk otomatis berkurang. Jika stok 0, tombol beli di halaman pelanggan akan terkunci dan checkout ditolak oleh server.

Untuk database lama, jalankan file opsional:

```txt
supabase/_optional_legacy_fix/add_product_stock_system.sql
```
