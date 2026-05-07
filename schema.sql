-- Return-Gift Shop v1 schema
-- Paste into Supabase Dashboard → SQL Editor → Run.

-- ---------- CATEGORIES ----------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

insert into categories (name) values
  ('Marriages'),
  ('Birthdays'),
  ('Baby Shower'),
  ('Housewarming'),
  ('General')
on conflict (name) do nothing;

-- ---------- PRODUCTS ----------
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references categories(id) on delete set null,
  bought_price numeric(10,2) not null check (bought_price >= 0),
  selling_price numeric(10,2) not null check (selling_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  image_url text,
  low_stock_threshold integer not null default 5,
  owner_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  margin numeric(10,2) generated always as (selling_price - bought_price) stored,
  margin_pct numeric(6,2) generated always as (
    case when bought_price = 0 then 0
         else round(((selling_price - bought_price) / bought_price) * 100, 2)
    end
  ) stored
);

create index if not exists products_owner_idx on products (owner_id);
create index if not exists products_category_idx on products (category_id);

-- keep updated_at fresh
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists products_set_updated_at on products;
create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();

-- ---------- RLS ----------
alter table products enable row level security;
alter table categories enable row level security;

drop policy if exists "owner reads own products" on products;
create policy "owner reads own products" on products
  for select using (auth.uid() = owner_id);

drop policy if exists "owner writes own products" on products;
create policy "owner writes own products" on products
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "anyone reads categories" on categories;
create policy "anyone reads categories" on categories
  for select using (true);

-- ---------- STORAGE ----------
-- Run ONCE in Supabase Dashboard → Storage → New bucket:
--   Name: product-images
--   Public: YES
-- Then run these policies (SQL editor):
--
-- create policy "public read product-images" on storage.objects
--   for select using (bucket_id = 'product-images');
-- create policy "authed upload product-images" on storage.objects
--   for insert with check (bucket_id = 'product-images' and auth.role() = 'authenticated');
-- create policy "authed update own product-images" on storage.objects
--   for update using (bucket_id = 'product-images' and auth.uid() = owner);
-- create policy "authed delete own product-images" on storage.objects
--   for delete using (bucket_id = 'product-images' and auth.uid() = owner);
