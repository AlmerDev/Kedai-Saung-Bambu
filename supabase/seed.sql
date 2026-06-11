-- Data awal KEDAI SAUNG BAMBU.
-- Jalankan setelah schema.sql.

insert into public.store_settings (id, store_name, tagline, address, whatsapp, service_fee_percent, opening_hours)
values (
  1,
  'KEDAI SAUNG BAMBU',
  'Warkop nyaman dengan ayam bakar, ayam goreng, minuman segar, kopi, dan cemilan hangat.',
  'Jl. Saung Bambu No. 17, Indonesia',
  '6281234567890',
  0,
  'Setiap hari 09.00 - 22.00'
)
on conflict (id) do update set
  store_name = excluded.store_name,
  tagline = excluded.tagline,
  address = excluded.address,
  whatsapp = excluded.whatsapp,
  service_fee_percent = excluded.service_fee_percent,
  opening_hours = excluded.opening_hours;

insert into public.categories (name, slug, emoji, sort_order, is_active) values
('Menu Ayam', 'menu-ayam', 'fa-solid fa-drumstick-bite', 1, true),
('Paket Nasi', 'paket-nasi', 'fa-solid fa-bowl-rice', 2, true),
('Minuman', 'minuman', 'fa-solid fa-glass-water', 3, true),
('Kopi & Teh', 'kopi-teh', 'fa-solid fa-mug-hot', 4, true),
('Makanan Ringan', 'makanan-ringan', 'fa-solid fa-cookie-bite', 5, true)
on conflict (slug) do update set name = excluded.name, emoji = excluded.emoji, sort_order = excluded.sort_order, is_active = excluded.is_active;

insert into public.products (category_id, name, slug, description, price, stock, badge, sort_order, is_available)
select c.id, x.name, x.slug, x.description, x.price, x.stock, x.badge, x.sort_order, true
from (
  values
  ('menu-ayam', 'Ayam Bakar Bumbu Saung', 'ayam-bakar-bumbu-saung', 'Ayam bakar manis gurih dengan sambal dan lalapan.', 22000, 25, 'Best Seller', 1),
  ('menu-ayam', 'Ayam Goreng Serundeng', 'ayam-goreng-serundeng', 'Ayam goreng renyah dengan taburan serundeng gurih.', 21000, 25, 'Favorit', 2),
  ('menu-ayam', 'Ayam Geprek Sambal Merah', 'ayam-geprek-sambal-merah', 'Ayam crispy digeprek sambal merah pedas.', 19000, 20, 'Pedas', 3),
  ('paket-nasi', 'Paket Ayam Bakar Komplit', 'paket-ayam-bakar-komplit', 'Nasi, ayam bakar, tahu, tempe, lalapan, sambal.', 28000, 18, 'Komplit', 1),
  ('paket-nasi', 'Paket Ayam Goreng Komplit', 'paket-ayam-goreng-komplit', 'Nasi, ayam goreng, tahu, tempe, lalapan, sambal.', 27000, 18, 'Hemat', 2),
  ('minuman', 'Es Teh Manis Jumbo', 'es-teh-manis-jumbo', 'Es teh manis segar ukuran jumbo.', 6000, 40, null, 1),
  ('minuman', 'Es Jeruk Peras', 'es-jeruk-peras', 'Jeruk peras segar dengan es batu.', 9000, 35, 'Segar', 2),
  ('minuman', 'Susu Jahe Hangat', 'susu-jahe-hangat', 'Susu jahe hangat cocok buat nongkrong malam.', 12000, 25, null, 3),
  ('kopi-teh', 'Kopi Susu Saung', 'kopi-susu-saung', 'Kopi susu creamy racikan khas saung.', 15000, 30, 'Signature', 1),
  ('kopi-teh', 'Kopi Hitam Tubruk', 'kopi-hitam-tubruk', 'Kopi hitam klasik ala warkop.', 8000, 35, null, 2),
  ('makanan-ringan', 'Pisang Goreng Keju', 'pisang-goreng-keju', 'Pisang goreng hangat dengan keju dan susu.', 14000, 20, 'Manis', 1),
  ('makanan-ringan', 'Kentang Sosis Saus Merah', 'kentang-sosis-saus-merah', 'Kentang dan sosis goreng dengan saus khas.', 16000, 20, null, 2),
  ('makanan-ringan', 'Tahu Crispy Sambal Kecap', 'tahu-crispy-sambal-kecap', 'Tahu crispy gurih dengan sambal kecap.', 12000, 25, null, 3)
) as x(category_slug, name, slug, description, price, stock, badge, sort_order)
join public.categories c on c.slug = x.category_slug
on conflict (slug) do update set
  category_id = excluded.category_id,
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  stock = excluded.stock,
  badge = excluded.badge,
  sort_order = excluded.sort_order,
  is_available = excluded.is_available;

insert into public.dining_tables (table_number, label, is_active)
select n::text, 'Meja ' || n::text, true
from generate_series(1, 12) as n
on conflict (table_number) do update set label = excluded.label, is_active = excluded.is_active;
