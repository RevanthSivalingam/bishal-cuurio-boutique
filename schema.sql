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

-- ---------- SALES ----------
create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  bill_number text not null,
  subtotal numeric(10,2) not null check (subtotal >= 0),
  discount_pct numeric(5,2) not null default 0 check (discount_pct >= 0 and discount_pct <= 100),
  discount_amount numeric(10,2) not null default 0 check (discount_amount >= 0),
  total numeric(10,2) not null check (total >= 0),
  customer_name text,
  customer_phone text,
  status text not null default 'active' check (status in ('active', 'void')),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  unique (owner_id, bill_number)
);

create index if not exists sales_owner_created_idx on sales (owner_id, created_at desc);
create index if not exists sales_status_idx on sales (owner_id, status);

create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references sales(id) on delete cascade not null,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  unit_bought_price numeric(10,2) not null,
  unit_sell_price numeric(10,2) not null,
  quantity integer not null check (quantity > 0),
  line_total numeric(10,2) generated always as (unit_sell_price * quantity) stored
);

create index if not exists sale_items_sale_idx on sale_items (sale_id);
create index if not exists sale_items_product_idx on sale_items (product_id);

create table if not exists bill_counters (
  owner_id uuid references auth.users(id) on delete cascade,
  year integer not null,
  counter integer not null default 0,
  primary key (owner_id, year)
);

-- RLS
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table bill_counters enable row level security;

drop policy if exists "owner reads own sales" on sales;
create policy "owner reads own sales" on sales
  for select using (auth.uid() = owner_id);

drop policy if exists "owner writes own sales" on sales;
create policy "owner writes own sales" on sales
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "owner reads own sale_items" on sale_items;
create policy "owner reads own sale_items" on sale_items
  for select using (
    exists (select 1 from sales s where s.id = sale_items.sale_id and s.owner_id = auth.uid())
  );

drop policy if exists "owner writes own sale_items" on sale_items;
create policy "owner writes own sale_items" on sale_items
  for all using (
    exists (select 1 from sales s where s.id = sale_items.sale_id and s.owner_id = auth.uid())
  ) with check (
    exists (select 1 from sales s where s.id = sale_items.sale_id and s.owner_id = auth.uid())
  );

drop policy if exists "owner manages own counters" on bill_counters;
create policy "owner manages own counters" on bill_counters
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------- create_sale RPC ----------
create or replace function create_sale(
  p_items jsonb,
  p_discount_pct numeric default 0,
  p_customer_name text default null,
  p_customer_phone text default null
) returns sales
language plpgsql
security invoker
as $$
declare
  v_owner uuid := auth.uid();
  v_year integer := extract(year from now())::integer;
  v_counter integer;
  v_bill_number text;
  v_sale sales%rowtype;
  v_subtotal numeric(10,2) := 0;
  v_discount_amount numeric(10,2);
  v_total numeric(10,2);
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_unit_sell_price numeric(10,2);
  v_product record;
begin
  if v_owner is null then
    raise exception 'not authenticated';
  end if;

  if p_discount_pct < 0 or p_discount_pct > 100 then
    raise exception 'discount_pct must be between 0 and 100';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'cart is empty';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_sell_price := (v_item->>'unit_sell_price')::numeric(10,2);

    if v_quantity <= 0 then
      raise exception 'quantity must be positive';
    end if;
    if v_unit_sell_price < 0 then
      raise exception 'unit_sell_price must be >= 0';
    end if;

    select * into v_product from products
      where id = v_product_id and owner_id = v_owner
      for update;

    if v_product.id is null then
      raise exception 'product % not found or not owned', v_product_id;
    end if;
    if v_product.stock < v_quantity then
      raise exception 'insufficient stock for %: have %, need %',
        v_product.name, v_product.stock, v_quantity;
    end if;

    v_subtotal := v_subtotal + (v_unit_sell_price * v_quantity);
  end loop;

  v_discount_amount := round(v_subtotal * p_discount_pct / 100, 2);
  v_total := v_subtotal - v_discount_amount;

  insert into bill_counters (owner_id, year, counter)
    values (v_owner, v_year, 1)
    on conflict (owner_id, year)
    do update set counter = bill_counters.counter + 1
    returning counter into v_counter;
  v_bill_number := 'B-' || v_year::text || '-' || lpad(v_counter::text, 4, '0');

  insert into sales (owner_id, bill_number, subtotal, discount_pct, discount_amount, total, customer_name, customer_phone)
    values (v_owner, v_bill_number, v_subtotal, p_discount_pct, v_discount_amount, v_total, p_customer_name, p_customer_phone)
    returning * into v_sale;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_sell_price := (v_item->>'unit_sell_price')::numeric(10,2);

    select * into v_product from products where id = v_product_id;

    insert into sale_items (sale_id, product_id, product_name, unit_bought_price, unit_sell_price, quantity)
      values (v_sale.id, v_product_id, v_product.name, v_product.bought_price, v_unit_sell_price, v_quantity);

    update products set stock = stock - v_quantity where id = v_product_id;
  end loop;

  return v_sale;
end;
$$;

-- ---------- void_sale RPC ----------
create or replace function void_sale(p_sale_id uuid) returns sales
language plpgsql
security invoker
as $$
declare
  v_owner uuid := auth.uid();
  v_sale sales%rowtype;
  v_item record;
begin
  select * into v_sale from sales
    where id = p_sale_id and owner_id = v_owner
    for update;

  if v_sale.id is null then
    raise exception 'sale not found';
  end if;
  if v_sale.status = 'void' then
    raise exception 'sale already voided';
  end if;
  if v_sale.created_at < now() - interval '24 hours' then
    raise exception 'void window expired (24h)';
  end if;

  update sales set status = 'void', voided_at = now() where id = p_sale_id returning * into v_sale;

  for v_item in select product_id, quantity from sale_items where sale_id = p_sale_id
  loop
    if v_item.product_id is not null then
      update products set stock = stock + v_item.quantity where id = v_item.product_id;
    end if;
  end loop;

  return v_sale;
end;
$$;

-- ---------- PUBLIC CATALOG POLICIES (added for catalog feature) ----------
-- Anyone (including anonymous) can read products and categories.
-- Writes remain owner-only for products; any authenticated user can manage categories
-- (categories are a single global list in this app).

drop policy if exists "owner reads own products" on products;
drop policy if exists "public reads products" on products;
create policy "public reads products" on products
  for select using (true);

drop policy if exists "anyone reads categories" on categories;
drop policy if exists "public reads categories" on categories;
create policy "public reads categories" on categories
  for select using (true);

drop policy if exists "authed manages categories" on categories;
create policy "authed manages categories" on categories
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ---------- STOCK ADJUSTMENTS (audit log) ----------
create table if not exists stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  product_id uuid references products(id) on delete cascade not null,
  old_stock integer not null,
  new_stock integer not null check (new_stock >= 0),
  delta integer generated always as (new_stock - old_stock) stored,
  mode text not null check (mode in ('set', 'adjust')),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists stock_adjustments_owner_created_idx
  on stock_adjustments (owner_id, created_at desc);
create index if not exists stock_adjustments_product_idx
  on stock_adjustments (product_id);

alter table stock_adjustments enable row level security;

drop policy if exists "owner reads own stock_adjustments" on stock_adjustments;
create policy "owner reads own stock_adjustments" on stock_adjustments
  for select using (auth.uid() = owner_id);

drop policy if exists "owner writes own stock_adjustments" on stock_adjustments;
create policy "owner writes own stock_adjustments" on stock_adjustments
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------- adjust_stock RPC ----------
-- Applies a batch of stock adjustments atomically. Each entry:
--   { product_id, mode: 'set' | 'adjust', value: int, reason?: string }
-- 'set': new_stock = value
-- 'adjust': new_stock = current_stock + value  (value may be negative)
-- Rejects the whole batch if any result would be negative or any product is not owned.
create or replace function adjust_stock(p_items jsonb) returns integer
language plpgsql
security invoker
as $$
declare
  v_owner uuid := auth.uid();
  v_item jsonb;
  v_product_id uuid;
  v_mode text;
  v_value integer;
  v_reason text;
  v_product record;
  v_new_stock integer;
  v_count integer := 0;
begin
  if v_owner is null then
    raise exception 'not authenticated';
  end if;
  if jsonb_array_length(p_items) = 0 then
    return 0;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_mode := v_item->>'mode';
    v_value := (v_item->>'value')::integer;
    v_reason := v_item->>'reason';

    if v_mode not in ('set', 'adjust') then
      raise exception 'invalid mode: %', v_mode;
    end if;

    select * into v_product from products
      where id = v_product_id and owner_id = v_owner
      for update;
    if v_product.id is null then
      raise exception 'product % not found or not owned', v_product_id;
    end if;

    if v_mode = 'set' then
      v_new_stock := v_value;
    else
      v_new_stock := v_product.stock + v_value;
    end if;

    if v_new_stock < 0 then
      raise exception 'result would be negative for %: % -> %',
        v_product.name, v_product.stock, v_new_stock;
    end if;

    -- Skip no-op entries (saves log noise)
    if v_new_stock = v_product.stock then
      continue;
    end if;

    insert into stock_adjustments
      (owner_id, product_id, old_stock, new_stock, mode, reason)
      values (v_owner, v_product_id, v_product.stock, v_new_stock, v_mode, v_reason);

    update products set stock = v_new_stock where id = v_product_id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------- OFFLINE / BACKDATED SALES ----------
-- occurred_at = when the sale actually happened (may be backdated).
-- created_at stays as record-creation stamp for audit.
-- channel distinguishes sales captured through the app ('online') from
-- those entered after the fact ('offline').
alter table sales add column if not exists occurred_at timestamptz;
update sales set occurred_at = created_at where occurred_at is null;
alter table sales alter column occurred_at set not null;
alter table sales alter column occurred_at set default now();

alter table sales add column if not exists channel text;
update sales set channel = 'online' where channel is null;
alter table sales alter column channel set not null;
alter table sales alter column channel set default 'online';
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sales_channel_check'
  ) then
    alter table sales add constraint sales_channel_check
      check (channel in ('online', 'offline'));
  end if;
end $$;

create index if not exists sales_owner_occurred_idx on sales (owner_id, occurred_at desc);

-- Re-create create_sale with occurred_at + channel support
create or replace function create_sale(
  p_items jsonb,
  p_discount_pct numeric default 0,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_occurred_at timestamptz default null,
  p_channel text default 'online'
) returns sales
language plpgsql
security invoker
as $$
declare
  v_owner uuid := auth.uid();
  v_occurred timestamptz := coalesce(p_occurred_at, now());
  v_year integer := extract(year from v_occurred)::integer;
  v_counter integer;
  v_bill_number text;
  v_sale sales%rowtype;
  v_subtotal numeric(10,2) := 0;
  v_discount_amount numeric(10,2);
  v_total numeric(10,2);
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_unit_sell_price numeric(10,2);
  v_product record;
begin
  if v_owner is null then
    raise exception 'not authenticated';
  end if;
  if p_channel not in ('online', 'offline') then
    raise exception 'invalid channel: %', p_channel;
  end if;
  if p_discount_pct < 0 or p_discount_pct > 100 then
    raise exception 'discount_pct must be between 0 and 100';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'cart is empty';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_sell_price := (v_item->>'unit_sell_price')::numeric(10,2);
    if v_quantity <= 0 then
      raise exception 'quantity must be positive';
    end if;
    if v_unit_sell_price < 0 then
      raise exception 'unit_sell_price must be >= 0';
    end if;

    select * into v_product from products
      where id = v_product_id and owner_id = v_owner
      for update;
    if v_product.id is null then
      raise exception 'product % not found or not owned', v_product_id;
    end if;
    if v_product.stock < v_quantity then
      raise exception 'insufficient stock for %: have %, need %',
        v_product.name, v_product.stock, v_quantity;
    end if;

    v_subtotal := v_subtotal + (v_unit_sell_price * v_quantity);
  end loop;

  v_discount_amount := round(v_subtotal * p_discount_pct / 100, 2);
  v_total := v_subtotal - v_discount_amount;

  insert into bill_counters (owner_id, year, counter)
    values (v_owner, v_year, 1)
    on conflict (owner_id, year)
    do update set counter = bill_counters.counter + 1
    returning counter into v_counter;
  v_bill_number := 'B-' || v_year::text || '-' || lpad(v_counter::text, 4, '0');

  insert into sales (owner_id, bill_number, subtotal, discount_pct, discount_amount, total,
                     customer_name, customer_phone, occurred_at, channel)
    values (v_owner, v_bill_number, v_subtotal, p_discount_pct, v_discount_amount, v_total,
            p_customer_name, p_customer_phone, v_occurred, p_channel)
    returning * into v_sale;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_sell_price := (v_item->>'unit_sell_price')::numeric(10,2);

    select * into v_product from products where id = v_product_id;

    insert into sale_items (sale_id, product_id, product_name, unit_bought_price, unit_sell_price, quantity)
      values (v_sale.id, v_product_id, v_product.name, v_product.bought_price, v_unit_sell_price, v_quantity);

    update products set stock = stock - v_quantity where id = v_product_id;
  end loop;

  return v_sale;
end;
$$;
