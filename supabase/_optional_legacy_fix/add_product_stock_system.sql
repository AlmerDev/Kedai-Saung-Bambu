-- Jalankan file ini hanya kalau database lama belum punya sistem stok.

alter table public.products
add column if not exists stock integer not null default 0 check (stock >= 0);

alter table public.orders
add column if not exists stock_restored boolean not null default false;

create or replace function public.decrement_product_stock(p_product_id uuid, p_quantity int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count int;
begin
  if p_quantity <= 0 then
    return false;
  end if;

  update public.products
  set stock = stock - p_quantity,
      updated_at = now()
  where id = p_product_id
    and is_available = true
    and stock >= p_quantity;

  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

create or replace function public.increase_product_stock(p_product_id uuid, p_quantity int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_quantity <= 0 then
    return false;
  end if;

  update public.products
  set stock = stock + p_quantity,
      updated_at = now()
  where id = p_product_id;

  return true;
end;
$$;

create or replace function public.restore_order_stock(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  already_restored boolean;
begin
  select stock_restored
  into already_restored
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    return false;
  end if;

  if already_restored then
    return true;
  end if;

  update public.products p
  set stock = p.stock + oi.quantity,
      updated_at = now()
  from public.order_items oi
  where oi.order_id = p_order_id
    and oi.product_id = p.id;

  update public.orders
  set stock_restored = true,
      updated_at = now()
  where id = p_order_id;

  return true;
end;
$$;

notify pgrst, 'reload schema';
