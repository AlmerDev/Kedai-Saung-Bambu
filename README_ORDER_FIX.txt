KEDAI SAUNG BAMBU - FIX ORDER FINAL

Yang sudah dibenerin di versi ini:
- Build error /api/orders sudah hilang.
- app/api/orders/route.ts sekarang hanya POST, tidak ada GET params id.
- app/api/orders/[id]/route.ts sudah benar untuk detail order.
- Checkout tetap bisa membuat order walaupun database lama belum punya kolom payment_type/payment_channel.
- API order dan Midtrans selalu balikin JSON yang jelas.
- Tampilan admin dibuat lebih kontras, tidak putih semua.

WAJIB CEK:
1. Di .env.local atau Vercel ENV, SUPABASE_SERVICE_ROLE_KEY harus service_role key, BUKAN anon/public key.
2. Jalankan supabase/fix_order_final.sql di Supabase SQL Editor.
3. Kalau deploy Vercel, setelah ganti ENV harus Redeploy.

Update ke folder lama:
- Copy semua isi folder ini ke folder project lama.
- Jangan timpa/hapus .env.local, .git, node_modules, .next.
- Jalankan:
  npm install
  npm run build

Lalu push:
  git add .
  git commit -m "fix order checkout final"
  git push
