# Sales Tracking & Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-line sales entry with stock decrement, PDF bill generation, 24h voids, and date-range profit reports to the existing Next 16 + Supabase boutique app.

**Architecture:** New `sales` and `sale_items` tables with per-owner RLS. All writes go through Postgres RPCs (`create_sale`, `void_sale`) that atomically update stock under row locks, preventing overselling. UI adds four new routes (`/sales`, `/sales/new`, `/sales/[id]`, `/reports`) plus nav links. PDF is generated client-side via `jspdf` — no server round-trip. Pure-logic helpers (discount math, profit aggregation, zod validation) are unit-tested with Vitest.

**Tech Stack:** Next.js 16.2.5 (App Router, `proxy.ts` middleware), React 19, Supabase SSR (`@supabase/ssr`), Postgres 15+, Tailwind 4, Zod 4, React Hook Form, jspdf, Vitest.

**Spec:** [docs/superpowers/specs/2026-05-07-sales-tracking-design.md](../specs/2026-05-07-sales-tracking-design.md)

---

## File Structure

### New files

| Path | Responsibility |
| --- | --- |
| `vitest.config.ts` | Vitest config (jsdom env for React components, node for lib) |
| `vitest.setup.ts` | Test setup (imports jest-dom matchers) |
| `lib/sales.ts` | RPC wrappers + pure helpers (subtotal, discount, total, profit calc) |
| `lib/sales.test.ts` | Unit tests for pure helpers |
| `lib/bill-number.ts` | Bill-number formatting helpers (reserved but logic lives server-side in RPC) |
| `components/product-picker.tsx` | Type-ahead search for products, emits onAdd(product) |
| `components/cart.tsx` | Cart line-item table/cards with qty/price editing |
| `components/bill-pdf.ts` | `generateBillPdf(sale, items)` → jspdf Blob + download |
| `components/void-dialog.tsx` | Confirm-dialog wrapper |
| `components/ui/dialog.tsx` | Minimal headless dialog primitive (only if not already present) |
| `app/sales/page.tsx` | Bill list — date filter, status filter |
| `app/sales/new/page.tsx` | Cart + checkout flow |
| `app/sales/[id]/page.tsx` | Single bill view — download PDF, void |
| `app/reports/page.tsx` | Date-range picker, totals, top products, low-stock panel |

### Modified files

| Path | Change |
| --- | --- |
| `schema.sql` | Append sales/sale_items/bill_counters tables, `create_sale`/`void_sale` RPCs, RLS policies |
| `lib/schemas.ts` | Add `cartLineSchema`, `cartSchema`, `createSaleInputSchema`, `Sale` and `SaleItem` types |
| `components/top-nav.tsx` | Add Sales + Reports nav links; rename title link target to /inventory kept |
| `package.json` | Add `jspdf`, `vitest`, `@vitest/ui`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom` |
| `.env.example` | Add `NEXT_PUBLIC_SHOP_NAME`, `NEXT_PUBLIC_GST_NUMBER` |
| `.env.local` | Same (user fills values) |

---

## Task 1: Install deps + set up Vitest

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`, `lib/smoke.test.ts`
- Modify: `package.json`, `tsconfig.json`

- [ ] **Step 1: Install runtime and test deps**

Run:
```bash
npm install jspdf
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```
Expected: installs succeed, no peer warnings beyond pre-existing postcss moderate advisory.

- [ ] **Step 2: Add test script to package.json**

Modify `package.json` `"scripts"` block:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Create vitest.config.ts**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    include: ["**/*.test.ts", "**/*.test.tsx"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

- [ ] **Step 4: Create vitest.setup.ts**

Create `vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Add vitest globals to tsconfig**

In `tsconfig.json`, ensure `compilerOptions.types` includes `"vitest/globals"` and `"@testing-library/jest-dom"`. If `types` does not exist, add:
```json
"types": ["vitest/globals", "@testing-library/jest-dom"]
```

- [ ] **Step 6: Write smoke test**

Create `lib/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 7: Run smoke test**

Run: `npm test`
Expected: 1 passed. If vitest picks up `node_modules/**` tests, add `exclude: ["node_modules/**"]` to the `test` block in `vitest.config.ts`.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts tsconfig.json lib/smoke.test.ts
git commit -m "chore: add vitest and jspdf deps"
```

---

## Task 2: DB — sales, sale_items, bill_counters tables + RLS

**Files:**
- Modify: `schema.sql`

No unit tests; this is DB DDL the user pastes into Supabase SQL Editor. Verification is manual via Supabase Dashboard.

- [ ] **Step 1: Append new tables to schema.sql**

Add to the end of `schema.sql`:

```sql
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
```

- [ ] **Step 2: User runs this in Supabase SQL Editor**

Copy the appended block into Supabase Dashboard → SQL Editor → Run.
Expected: "Success. No rows returned."

- [ ] **Step 3: Manually verify tables in Supabase Dashboard**

Go to Table Editor. Confirm presence of `sales`, `sale_items`, `bill_counters`. Each should have RLS enabled (shield icon).

- [ ] **Step 4: Commit**

```bash
git add schema.sql
git commit -m "feat(db): add sales, sale_items, bill_counters tables with RLS"
```

---

## Task 3: DB — create_sale RPC

**Files:**
- Modify: `schema.sql`

- [ ] **Step 1: Append create_sale function to schema.sql**

```sql
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

  -- Lock products + validate stock + compute subtotal
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

  -- Allocate bill number
  insert into bill_counters (owner_id, year, counter)
    values (v_owner, v_year, 1)
    on conflict (owner_id, year)
    do update set counter = bill_counters.counter + 1
    returning counter into v_counter;
  v_bill_number := 'B-' || v_year::text || '-' || lpad(v_counter::text, 4, '0');

  -- Insert sale
  insert into sales (owner_id, bill_number, subtotal, discount_pct, discount_amount, total, customer_name, customer_phone)
    values (v_owner, v_bill_number, v_subtotal, p_discount_pct, v_discount_amount, v_total, p_customer_name, p_customer_phone)
    returning * into v_sale;

  -- Insert line items + decrement stock
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
```

- [ ] **Step 2: User runs in Supabase SQL Editor**

Expected: "Success. No rows returned."

- [ ] **Step 3: Manual verification**

In Supabase SQL Editor, run a dry-run for a test user:
```sql
select create_sale(
  '[{"product_id":"<paste-a-real-product-uuid>","quantity":1,"unit_sell_price":100}]'::jsonb,
  10,
  'Test Customer',
  null
);
```
Expected: returns a sales row with bill_number like `B-2026-0001`, subtotal=100, discount_amount=10, total=90. Verify in Table Editor that the matching product's `stock` decreased by 1 and a `sale_items` row exists.

- [ ] **Step 4: Clean up test data**

```sql
delete from sales where customer_name = 'Test Customer';
update products set stock = stock + 1 where id = '<that-product-uuid>';
delete from bill_counters where counter = 1 and year = 2026;
```

- [ ] **Step 5: Commit**

```bash
git add schema.sql
git commit -m "feat(db): create_sale RPC with atomic stock decrement"
```

---

## Task 4: DB — void_sale RPC

**Files:**
- Modify: `schema.sql`

- [ ] **Step 1: Append void_sale function**

```sql
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
```

- [ ] **Step 2: User runs in Supabase SQL Editor**

Expected: "Success. No rows returned."

- [ ] **Step 3: Commit**

```bash
git add schema.sql
git commit -m "feat(db): void_sale RPC with 24h window and stock restore"
```

---

## Task 5: Lib — zod schemas + TS types for sales

**Files:**
- Modify: `lib/schemas.ts`

- [ ] **Step 1: Add cart and sale schemas**

Append to `lib/schemas.ts`:
```ts
export const cartLineSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string().min(1),
  quantity: z.coerce.number().int().min(1),
  unit_sell_price: z.coerce.number().min(0),
  stock_at_add: z.coerce.number().int().min(0),
});
export type CartLine = z.infer<typeof cartLineSchema>;

export const createSaleInputSchema = z.object({
  items: z.array(cartLineSchema).min(1, "Add at least one item"),
  discount_pct: z.coerce.number().min(0).max(100).default(0),
  customer_name: z.string().trim().max(80).optional().or(z.literal("")),
  customer_phone: z.string().trim().max(20).optional().or(z.literal("")),
});
export type CreateSaleInput = z.infer<typeof createSaleInputSchema>;

export type Sale = {
  id: string;
  owner_id: string;
  bill_number: string;
  subtotal: number;
  discount_pct: number;
  discount_amount: number;
  total: number;
  customer_name: string | null;
  customer_phone: string | null;
  status: "active" | "void";
  created_at: string;
  voided_at: string | null;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string;
  unit_bought_price: number;
  unit_sell_price: number;
  quantity: number;
  line_total: number;
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/schemas.ts
git commit -m "feat(types): add sale + cart zod schemas and types"
```

---

## Task 6: Lib — pure helpers (subtotal, discount, total) with TDD

**Files:**
- Create: `lib/sales.ts`, `lib/sales.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/sales.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeSubtotal, computeDiscountAmount, computeTotal, computeProfit } from "./sales";
import type { CartLine, SaleItem } from "./schemas";

const line = (overrides: Partial<CartLine> = {}): CartLine => ({
  product_id: "00000000-0000-0000-0000-000000000001",
  product_name: "Item",
  quantity: 1,
  unit_sell_price: 100,
  stock_at_add: 10,
  ...overrides,
});

describe("computeSubtotal", () => {
  it("returns 0 for empty cart", () => {
    expect(computeSubtotal([])).toBe(0);
  });
  it("sums quantity * unit_sell_price per line", () => {
    expect(
      computeSubtotal([line({ quantity: 2, unit_sell_price: 50 }), line({ quantity: 3, unit_sell_price: 10 })])
    ).toBe(130);
  });
});

describe("computeDiscountAmount", () => {
  it("returns 0 when discount_pct is 0", () => {
    expect(computeDiscountAmount(100, 0)).toBe(0);
  });
  it("rounds to 2 decimals", () => {
    expect(computeDiscountAmount(99.99, 10)).toBe(10.0);
    expect(computeDiscountAmount(33.33, 33)).toBe(11.0);
  });
  it("clamps discount_pct to [0, 100]", () => {
    expect(computeDiscountAmount(100, -5)).toBe(0);
    expect(computeDiscountAmount(100, 150)).toBe(100);
  });
});

describe("computeTotal", () => {
  it("is subtotal - discount_amount", () => {
    expect(computeTotal(100, 10)).toBe(90);
  });
  it("never negative", () => {
    expect(computeTotal(50, 100)).toBe(0);
  });
});

describe("computeProfit", () => {
  const saleItem = (overrides: Partial<SaleItem> = {}): SaleItem => ({
    id: "x",
    sale_id: "s",
    product_id: "p",
    product_name: "P",
    unit_bought_price: 40,
    unit_sell_price: 100,
    quantity: 1,
    line_total: 100,
    ...overrides,
  });
  it("sums (sell - bought) * quantity", () => {
    expect(
      computeProfit([saleItem({ quantity: 2 }), saleItem({ unit_bought_price: 50, unit_sell_price: 80, quantity: 3 })])
    ).toBe((100 - 40) * 2 + (80 - 50) * 3);
  });
  it("is 0 for empty", () => {
    expect(computeProfit([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm test`
Expected: all 4 describe blocks fail with "cannot find module './sales'" or similar.

- [ ] **Step 3: Implement helpers**

Create `lib/sales.ts`:
```ts
import type { CartLine, SaleItem } from "./schemas";

export const computeSubtotal = (lines: CartLine[]): number =>
  lines.reduce((sum, l) => sum + l.quantity * l.unit_sell_price, 0);

export const computeDiscountAmount = (subtotal: number, discountPct: number): number => {
  const clamped = Math.min(100, Math.max(0, discountPct));
  return Math.round(subtotal * clamped) / 100;
};

export const computeTotal = (subtotal: number, discountAmount: number): number =>
  Math.max(0, subtotal - discountAmount);

export const computeProfit = (items: SaleItem[]): number =>
  items.reduce((sum, i) => sum + (i.unit_sell_price - i.unit_bought_price) * i.quantity, 0);
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/sales.ts lib/sales.test.ts
git commit -m "feat(lib): pure helpers for subtotal, discount, total, profit"
```

---

## Task 7: Lib — sales RPC wrappers

**Files:**
- Modify: `lib/sales.ts`

- [ ] **Step 1: Append RPC wrappers**

Add to `lib/sales.ts`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateSaleInput, Sale } from "./schemas";

export async function createSale(supabase: SupabaseClient, input: CreateSaleInput): Promise<Sale> {
  const { data, error } = await supabase.rpc("create_sale", {
    p_items: input.items.map((l) => ({
      product_id: l.product_id,
      quantity: l.quantity,
      unit_sell_price: l.unit_sell_price,
    })),
    p_discount_pct: input.discount_pct,
    p_customer_name: input.customer_name?.trim() || null,
    p_customer_phone: input.customer_phone?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return data as Sale;
}

export async function voidSale(supabase: SupabaseClient, saleId: string): Promise<Sale> {
  const { data, error } = await supabase.rpc("void_sale", { p_sale_id: saleId });
  if (error) throw new Error(error.message);
  return data as Sale;
}

export async function fetchSale(supabase: SupabaseClient, saleId: string) {
  const { data: sale, error: saleErr } = await supabase
    .from("sales")
    .select("*")
    .eq("id", saleId)
    .single();
  if (saleErr) throw new Error(saleErr.message);
  const { data: items, error: itemsErr } = await supabase
    .from("sale_items")
    .select("*")
    .eq("sale_id", saleId)
    .order("id");
  if (itemsErr) throw new Error(itemsErr.message);
  return { sale: sale as Sale, items: (items ?? []) as SaleItem[] };
}

export async function listSales(
  supabase: SupabaseClient,
  from: string,
  to: string,
  status?: "active" | "void"
) {
  let q = supabase
    .from("sales")
    .select("*")
    .gte("created_at", from)
    .lte("created_at", to)
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Sale[];
}

export async function fetchReportData(supabase: SupabaseClient, from: string, to: string) {
  const { data: sales, error: salesErr } = await supabase
    .from("sales")
    .select("*")
    .eq("status", "active")
    .gte("created_at", from)
    .lte("created_at", to);
  if (salesErr) throw new Error(salesErr.message);

  const saleIds = (sales ?? []).map((s) => s.id);
  if (saleIds.length === 0) return { sales: [] as Sale[], items: [] as SaleItem[] };

  const { data: items, error: itemsErr } = await supabase
    .from("sale_items")
    .select("*")
    .in("sale_id", saleIds);
  if (itemsErr) throw new Error(itemsErr.message);
  return { sales: (sales ?? []) as Sale[], items: (items ?? []) as SaleItem[] };
}
```

After adding the code above, the top of `lib/sales.ts` should have exactly one types import line combining both tasks' needs. Replace the Task 6 import line with:
```ts
import type { CartLine, CreateSaleInput, Sale, SaleItem } from "./schemas";
import type { SupabaseClient } from "@supabase/supabase-js";
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run unit tests**

Run: `npm test`
Expected: the pure-helper tests still pass (RPC wrappers are not tested — they're thin Supabase calls verified manually in later tasks).

- [ ] **Step 4: Commit**

```bash
git add lib/sales.ts
git commit -m "feat(lib): add sales RPC wrappers and fetchers"
```

---

## Task 8: Env vars for shop name + GST

**Files:**
- Modify: `.env.example`, `.env.local`

- [ ] **Step 1: Update .env.example**

Overwrite `.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SHOP_NAME=Your Shop Name
NEXT_PUBLIC_GST_NUMBER=
```

- [ ] **Step 2: Ask user to update .env.local**

Tell the user: "Add `NEXT_PUBLIC_SHOP_NAME` and `NEXT_PUBLIC_GST_NUMBER` to `.env.local`. Leave GST blank if you don't have one yet." Do not commit `.env.local`.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore: add shop name and GST env vars"
```

---

## Task 9: Component — product-picker

**Files:**
- Create: `components/product-picker.tsx`

- [ ] **Step 1: Implement ProductPicker**

Create `components/product-picker.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Product } from "@/lib/schemas";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/money";

type Props = {
  onAdd: (p: Product) => void;
  excludeIds?: string[];
};

export function ProductPicker({ onAdd, excludeIds = [] }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const controller = new AbortController();
    const run = async () => {
      setLoading(true);
      const q = supabase
        .from("products")
        .select("*")
        .gt("stock", 0)
        .order("name")
        .limit(20);
      const { data } = query.trim()
        ? await q.ilike("name", `%${query.trim()}%`)
        : await q;
      if (!controller.signal.aborted) {
        const filtered = (data ?? []).filter((p) => !excludeIds.includes(p.id));
        setResults(filtered as Product[]);
        setLoading(false);
      }
    };
    const t = setTimeout(run, 200);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, excludeIds.join(",")]);

  return (
    <div className="flex flex-col gap-2">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search product by name..."
        autoFocus
      />
      <ul className="flex flex-col gap-1 max-h-64 overflow-y-auto">
        {loading && <li className="text-sm text-zinc-500 px-1">Loading...</li>}
        {!loading && results.length === 0 && (
          <li className="text-sm text-zinc-500 px-1">No matching in-stock products.</li>
        )}
        {results.map((p) => (
          <li key={p.id}>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between"
              onClick={() => onAdd(p)}
            >
              <span className="truncate text-left">{p.name}</span>
              <span className="text-xs text-zinc-500 shrink-0">
                {formatINR(p.selling_price)} · stock {p.stock}
              </span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If `@/components/ui/input` is missing, inspect `components/ui/` and adjust the import to match the actual primitive used by other forms (e.g. the existing `product-form.tsx`).

- [ ] **Step 3: Commit**

```bash
git add components/product-picker.tsx
git commit -m "feat: product-picker component with debounced search"
```

---

## Task 10: Component — cart

**Files:**
- Create: `components/cart.tsx`

- [ ] **Step 1: Implement Cart**

Create `components/cart.tsx`:
```tsx
"use client";

import { Trash2, Minus, Plus } from "lucide-react";
import type { CartLine } from "@/lib/schemas";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/money";

type Props = {
  lines: CartLine[];
  onChange: (lines: CartLine[]) => void;
};

export function Cart({ lines, onChange }: Props) {
  if (lines.length === 0) {
    return <p className="text-sm text-zinc-500">Cart is empty. Add products above.</p>;
  }

  const update = (idx: number, patch: Partial<CartLine>) =>
    onChange(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const remove = (idx: number) => onChange(lines.filter((_, i) => i !== idx));

  return (
    <ul className="flex flex-col gap-3">
      {lines.map((l, idx) => {
        const overStock = l.quantity > l.stock_at_add;
        return (
          <li key={`${l.product_id}-${idx}`} className="border border-zinc-200 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium truncate">{l.product_name}</p>
              <button
                type="button"
                onClick={() => remove(idx)}
                className="text-red-600 p-1"
                aria-label="Remove line"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => update(idx, { quantity: Math.max(1, l.quantity - 1) })}
                aria-label="Decrease quantity"
              >
                <Minus className="size-4" />
              </Button>
              <Input
                type="number"
                min={1}
                max={l.stock_at_add}
                value={l.quantity}
                onChange={(e) =>
                  update(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })
                }
                className="w-16 text-center"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() =>
                  update(idx, { quantity: Math.min(l.stock_at_add, l.quantity + 1) })
                }
                aria-label="Increase quantity"
              >
                <Plus className="size-4" />
              </Button>
              <span className="text-sm text-zinc-500">of {l.stock_at_add}</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-zinc-600 shrink-0">Price</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={l.unit_sell_price}
                onChange={(e) =>
                  update(idx, { unit_sell_price: Math.max(0, Number(e.target.value) || 0) })
                }
              />
            </div>
            <p className="text-right font-semibold">
              {formatINR(l.unit_sell_price * l.quantity)}
            </p>
            {overStock && (
              <p className="text-sm text-red-600">Exceeds stock ({l.stock_at_add})</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/cart.tsx
git commit -m "feat: cart component with qty stepper and price edit"
```

---

## Task 11: Component — bill-pdf

**Files:**
- Create: `components/bill-pdf.ts`

- [ ] **Step 1: Implement generator**

Create `components/bill-pdf.ts`:
```ts
import { jsPDF } from "jspdf";
import type { Sale, SaleItem } from "@/lib/schemas";
import { formatINR } from "@/lib/money";

type Options = {
  shopName: string;
  gstNumber: string | null;
};

export function generateBillPdf(sale: Sale, items: SaleItem[], opts: Options) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 15;
  const left = 15;
  const right = 195;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(opts.shopName, left, y);
  y += 6;
  if (opts.gstNumber) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`GSTIN: ${opts.gstNumber}`, left, y);
    y += 5;
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Bill: ${sale.bill_number}`, left, y);
  doc.text(new Date(sale.created_at).toLocaleString("en-IN"), right, y, { align: "right" });
  y += 6;

  if (sale.customer_name || sale.customer_phone) {
    doc.text(
      [
        sale.customer_name ? `Customer: ${sale.customer_name}` : "",
        sale.customer_phone ? `Phone: ${sale.customer_phone}` : "",
      ]
        .filter(Boolean)
        .join("   "),
      left,
      y
    );
    y += 6;
  }

  doc.line(left, y, right, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text("Item", left, y);
  doc.text("Qty", 120, y, { align: "right" });
  doc.text("Price", 150, y, { align: "right" });
  doc.text("Total", right, y, { align: "right" });
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.line(left, y, right, y);
  y += 5;

  for (const item of items) {
    if (y > 270) {
      doc.addPage();
      y = 15;
    }
    doc.text(item.product_name.slice(0, 45), left, y);
    doc.text(String(item.quantity), 120, y, { align: "right" });
    doc.text(formatINR(item.unit_sell_price), 150, y, { align: "right" });
    doc.text(formatINR(item.line_total), right, y, { align: "right" });
    y += 6;
  }

  doc.line(left, y, right, y);
  y += 6;
  doc.text("Subtotal", 150, y, { align: "right" });
  doc.text(formatINR(sale.subtotal), right, y, { align: "right" });
  y += 6;
  if (sale.discount_amount > 0) {
    doc.text(`Discount (${sale.discount_pct}%)`, 150, y, { align: "right" });
    doc.text(`- ${formatINR(sale.discount_amount)}`, right, y, { align: "right" });
    y += 6;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Grand Total", 150, y, { align: "right" });
  doc.text(formatINR(sale.total), right, y, { align: "right" });
  y += 10;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text("Thank you for shopping with us.", 105, y, { align: "center" });

  doc.save(`bill-${sale.bill_number}.pdf`);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/bill-pdf.ts
git commit -m "feat: client-side PDF bill generation via jspdf"
```

---

## Task 12: Component — void-dialog

**Files:**
- Create: `components/void-dialog.tsx`

- [ ] **Step 1: Implement VoidDialog**

Create `components/void-dialog.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  onConfirm: () => Promise<void>;
  disabled?: boolean;
};

export function VoidDialog({ onConfirm, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setErr(null);
    try {
      await onConfirm();
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Void failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Void bill
      </Button>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl p-6 max-w-sm w-full flex flex-col gap-4">
            <h2 className="font-semibold text-lg">Void this bill?</h2>
            <p className="text-sm text-zinc-600">
              Stock will be restored. This cannot be undone.
            </p>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirm} disabled={busy}>
                {busy ? "Voiding..." : "Confirm void"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/void-dialog.tsx
git commit -m "feat: void-dialog component"
```

---

## Task 13: Route — /sales/new (cart + checkout)

**Files:**
- Create: `app/sales/new/page.tsx`

- [ ] **Step 1: Implement page**

Create `app/sales/new/page.tsx`:
```tsx
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CartLine, Product } from "@/lib/schemas";
import { createSaleInputSchema } from "@/lib/schemas";
import { createSale, computeSubtotal, computeDiscountAmount, computeTotal } from "@/lib/sales";
import { ProductPicker } from "@/components/product-picker";
import { Cart } from "@/components/cart";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/money";

export default function NewSalePage() {
  const router = useRouter();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [discountPct, setDiscountPct] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [showCustomer, setShowCustomer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const excludeIds = useMemo(() => lines.map((l) => l.product_id), [lines]);
  const subtotal = computeSubtotal(lines);
  const discountAmount = computeDiscountAmount(subtotal, discountPct);
  const total = computeTotal(subtotal, discountAmount);

  const addProduct = (p: Product) => {
    setLines((curr) => [
      ...curr,
      {
        product_id: p.id,
        product_name: p.name,
        quantity: 1,
        unit_sell_price: p.selling_price,
        stock_at_add: p.stock,
      },
    ]);
  };

  const checkout = async () => {
    setError(null);
    const parsed = createSaleInputSchema.safeParse({
      items: lines,
      discount_pct: discountPct,
      customer_name: customerName,
      customer_phone: customerPhone,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid cart");
      return;
    }
    if (lines.some((l) => l.quantity > l.stock_at_add)) {
      setError("One or more lines exceed stock.");
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const sale = await createSale(supabase, parsed.data);
      router.push(`/sales/${sale.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto p-4 flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">New sale</h1>

      <section>
        <h2 className="font-medium mb-2">Add product</h2>
        <ProductPicker onAdd={addProduct} excludeIds={excludeIds} />
      </section>

      <section>
        <h2 className="font-medium mb-2">Cart</h2>
        <Cart lines={lines} onChange={setLines} />
      </section>

      <section className="flex flex-col gap-2 p-4 rounded-xl bg-zinc-50 border border-zinc-200">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatINR(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <label className="text-sm">Discount %</label>
          <Input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={discountPct}
            onChange={(e) =>
              setDiscountPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
            }
            className="w-24 text-right"
          />
        </div>
        <div className="flex justify-between text-sm text-zinc-600">
          <span>Discount amount</span>
          <span>- {formatINR(discountAmount)}</span>
        </div>
        <div className="flex justify-between font-semibold text-lg pt-2 border-t border-zinc-200">
          <span>Total</span>
          <span>{formatINR(total)}</span>
        </div>
      </section>

      <section>
        <button
          type="button"
          className="text-sm underline"
          onClick={() => setShowCustomer((v) => !v)}
        >
          {showCustomer ? "Hide" : "Add"} customer info (optional)
        </button>
        {showCustomer && (
          <div className="flex flex-col gap-2 mt-2">
            <Input
              placeholder="Customer name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <Input
              placeholder="Phone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>
        )}
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button
        type="button"
        size="lg"
        onClick={checkout}
        disabled={submitting || lines.length === 0}
      >
        {submitting ? "Processing..." : `Checkout · ${formatINR(total)}`}
      </Button>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`. Sign in. Visit `/sales/new`. Add a product, set qty 2, change discount to 10, enter customer name, press Checkout. Expected: redirects to `/sales/<uuid>` (404 until Task 14 — that's OK for now). Verify in Supabase Table Editor: new `sales` + `sale_items` rows, and the product's `stock` decremented by 2.

- [ ] **Step 4: Commit**

```bash
git add app/sales/new/page.tsx
git commit -m "feat(route): /sales/new — cart and checkout"
```

---

## Task 14: Route — /sales/[id] (bill view)

**Files:**
- Create: `app/sales/[id]/page.tsx`

- [ ] **Step 1: Implement page**

Create `app/sales/[id]/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchSale, voidSale } from "@/lib/sales";
import type { Sale, SaleItem } from "@/lib/schemas";
import { generateBillPdf } from "@/components/bill-pdf";
import { VoidDialog } from "@/components/void-dialog";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/money";

const VOID_WINDOW_MS = 24 * 60 * 60 * 1000;

export default function BillPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [sale, setSale] = useState<Sale | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    fetchSale(supabase, id)
      .then(({ sale, items }) => {
        setSale(sale);
        setItems(items);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [id]);

  if (error) return <main className="p-4"><p className="text-red-600">{error}</p></main>;
  if (!sale) return <main className="p-4">Loading...</main>;

  const voidable =
    sale.status === "active" &&
    Date.now() - new Date(sale.created_at).getTime() < VOID_WINDOW_MS;

  const download = () =>
    generateBillPdf(sale, items, {
      shopName: process.env.NEXT_PUBLIC_SHOP_NAME || "Boutique",
      gstNumber: process.env.NEXT_PUBLIC_GST_NUMBER || null,
    });

  const doVoid = async () => {
    const supabase = createSupabaseBrowserClient();
    const updated = await voidSale(supabase, sale.id);
    setSale(updated);
    router.refresh();
  };

  return (
    <main className="max-w-2xl mx-auto p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{sale.bill_number}</h1>
          <p className="text-sm text-zinc-500">
            {new Date(sale.created_at).toLocaleString("en-IN")}
          </p>
        </div>
        {sale.status === "void" && (
          <span className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-semibold">
            VOID
          </span>
        )}
      </div>

      {(sale.customer_name || sale.customer_phone) && (
        <section className="text-sm text-zinc-700">
          {sale.customer_name && <p>Customer: {sale.customer_name}</p>}
          {sale.customer_phone && <p>Phone: {sale.customer_phone}</p>}
        </section>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-zinc-200">
            <th className="py-1">Item</th>
            <th className="py-1 text-right">Qty</th>
            <th className="py-1 text-right">Price</th>
            <th className="py-1 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-b border-zinc-100">
              <td className="py-1">{i.product_name}</td>
              <td className="py-1 text-right">{i.quantity}</td>
              <td className="py-1 text-right">{formatINR(i.unit_sell_price)}</td>
              <td className="py-1 text-right">{formatINR(i.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="flex flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatINR(sale.subtotal)}</span>
        </div>
        {sale.discount_amount > 0 && (
          <div className="flex justify-between">
            <span>Discount ({sale.discount_pct}%)</span>
            <span>- {formatINR(sale.discount_amount)}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-semibold border-t border-zinc-200 pt-2">
          <span>Total</span>
          <span>{formatINR(sale.total)}</span>
        </div>
      </section>

      <div className="flex gap-2 flex-wrap">
        <Button onClick={download}>Download PDF</Button>
        {voidable && <VoidDialog onConfirm={doVoid} />}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Start dev server, navigate to the bill URL from Task 13's smoke test. Expected: bill shows correctly, Download PDF works, Void button appears. Click Void; confirm. Expected: page updates with VOID badge, Supabase `sales.status = 'void'`, product stock restored.

- [ ] **Step 4: Commit**

```bash
git add app/sales/[id]/page.tsx
git commit -m "feat(route): /sales/[id] — bill view with PDF and void"
```

---

## Task 15: Route — /sales (bill list)

**Files:**
- Create: `app/sales/page.tsx`

- [ ] **Step 1: Implement list page**

Create `app/sales/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { listSales } from "@/lib/sales";
import type { Sale } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/lib/money";

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function SalesListPage() {
  const [date, setDate] = useState(todayISO());
  const [status, setStatus] = useState<"all" | "active" | "void">("all");
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const from = new Date(`${date}T00:00:00`).toISOString();
    const to = new Date(`${date}T23:59:59.999`).toISOString();
    setLoading(true);
    listSales(supabase, from, to, status === "all" ? undefined : status)
      .then(setSales)
      .catch((e) => setErr(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [date, status]);

  const totalActive = sales
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + s.total, 0);

  return (
    <main className="max-w-3xl mx-auto p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold">Sales</h1>
        <Link href="/sales/new">
          <Button>+ New sale</Button>
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-auto"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="border border-zinc-200 rounded-md px-3 text-sm"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="void">Void</option>
        </select>
      </div>

      {err && <p className="text-red-600 text-sm">{err}</p>}
      {loading && <p className="text-sm text-zinc-500">Loading...</p>}

      <p className="text-sm text-zinc-600">
        {sales.length} bills · Total (active): <strong>{formatINR(totalActive)}</strong>
      </p>

      <ul className="flex flex-col gap-2">
        {sales.map((s) => (
          <li key={s.id}>
            <Link
              href={`/sales/${s.id}`}
              className="block border border-zinc-200 rounded-xl p-3 hover:bg-zinc-50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{s.bill_number}</span>
                <span className={s.status === "void" ? "text-red-600 text-xs" : "text-xs text-zinc-500"}>
                  {s.status === "void" ? "VOID" : new Date(s.created_at).toLocaleTimeString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-zinc-600 truncate">{s.customer_name ?? "Walk-in"}</span>
                <span>{formatINR(s.total)}</span>
              </div>
            </Link>
          </li>
        ))}
        {!loading && sales.length === 0 && (
          <li className="text-sm text-zinc-500">No bills for this date.</li>
        )}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Visit `/sales`. Expected: today's bills list with total. Change date/status filters; list refreshes. Clicking a bill opens its page.

- [ ] **Step 4: Commit**

```bash
git add app/sales/page.tsx
git commit -m "feat(route): /sales bill list with date/status filter"
```

---

## Task 16: Route — /reports

**Files:**
- Create: `app/reports/page.tsx`

- [ ] **Step 1: Implement reports**

Create `app/reports/page.tsx`:
```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchReportData, computeProfit } from "@/lib/sales";
import type { Sale, SaleItem, Product } from "@/lib/schemas";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/lib/money";

const startOfMonthISO = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function ReportsPage() {
  const [from, setFrom] = useState(startOfMonthISO());
  const [to, setTo] = useState(todayISO());
  const [sales, setSales] = useState<Sale[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const fromIso = new Date(`${from}T00:00:00`).toISOString();
    const toIso = new Date(`${to}T23:59:59.999`).toISOString();
    setLoading(true);
    Promise.all([
      fetchReportData(supabase, fromIso, toIso),
      supabase.from("products").select("*").order("stock", { ascending: true }),
    ])
      .then(([report, low]) => {
        setSales(report.sales);
        setItems(report.items);
        const prods = (low.data ?? []) as Product[];
        setLowStock(prods.filter((p) => p.stock <= p.low_stock_threshold));
      })
      .finally(() => setLoading(false));
  }, [from, to]);

  const totalSales = sales.reduce((s, x) => s + x.total, 0);
  const totalProfit = computeProfit(items);
  const itemsSold = items.reduce((s, x) => s + x.quantity, 0);

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number }>();
    for (const i of items) {
      const key = i.product_id ?? i.product_name;
      const curr = map.get(key) ?? { name: i.product_name, qty: 0 };
      curr.qty += i.quantity;
      map.set(key, curr);
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [items]);

  return (
    <main className="max-w-3xl mx-auto p-4 flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Reports</h1>

      <div className="flex gap-2 flex-wrap items-center">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
        <span>to</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
      </div>

      {loading && <p className="text-sm text-zinc-500">Loading...</p>}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Sales" value={formatINR(totalSales)} />
        <Card label="Profit" value={formatINR(totalProfit)} />
        <Card label="Bills" value={String(sales.length)} />
        <Card label="Items sold" value={String(itemsSold)} />
      </section>

      <section>
        <h2 className="font-medium mb-2">Top products</h2>
        {topProducts.length === 0 ? (
          <p className="text-sm text-zinc-500">No sales in range.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {topProducts.map((p) => (
              <li key={p.name} className="flex justify-between border-b border-zinc-100 py-1">
                <span>{p.name}</span>
                <span>{p.qty}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-medium mb-2">Low stock warning</h2>
        {lowStock.length === 0 ? (
          <p className="text-sm text-zinc-500">All products above threshold.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {lowStock.map((p) => (
              <li key={p.id} className="flex justify-between border-b border-zinc-100 py-1">
                <span>{p.name}</span>
                <span className="text-red-600">stock {p.stock} / threshold {p.low_stock_threshold}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-200 rounded-xl p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="font-semibold text-lg">{value}</p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Visit `/reports`. Expected: totals match sum of bills in range, profit uses `(unit_sell_price - unit_bought_price) * quantity` from snapshot prices, low-stock lists products with `stock <= low_stock_threshold`.

- [ ] **Step 4: Commit**

```bash
git add app/reports/page.tsx
git commit -m "feat(route): /reports — date-range totals, profit, top products, low stock"
```

---

## Task 17: Nav — add Sales + Reports links

**Files:**
- Modify: `components/top-nav.tsx`

- [ ] **Step 1: Update top-nav**

Replace `components/top-nav.tsx`:
```tsx
"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, Package, Receipt, BarChart3 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/inventory", label: "Inventory", Icon: Package },
  { href: "/sales", label: "Sales", Icon: Receipt },
  { href: "/reports", label: "Reports", Icon: BarChart3 },
];

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();

  const signOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-zinc-200">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/inventory" className="flex items-center gap-2 font-semibold shrink-0">
          <Package className="size-5" />
          <span>GiftShop</span>
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1 px-2 py-1 text-sm rounded-md ${
                  active ? "bg-zinc-100 font-medium" : "text-zinc-600"
                }`}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
        <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sign out">
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Typecheck + dev smoke**

Run: `npx tsc --noEmit` then `npm run dev`. Click each nav link; active state highlights correctly.

- [ ] **Step 3: Commit**

```bash
git add components/top-nav.tsx
git commit -m "feat(nav): add Sales and Reports links with active state"
```

---

## Task 18: End-to-end verification

**Files:** none (verification-only)

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: build succeeds, no type errors, no missing modules.

- [ ] **Step 2: Full test run**

Run: `npm test`
Expected: all unit tests pass.

- [ ] **Step 3: Manual e2e flow**

Run: `npm run dev`. Sign in. In the browser, do in order:
1. Add a product via inventory if none in stock.
2. Go to /sales/new, add product, set qty 2, discount 10%, add customer name "E2E Test", checkout.
3. On bill page, click Download PDF — verify file opens and shows shop name, GST (if env set), line item, totals.
4. Click Void. Confirm. Verify VOID badge appears.
5. Go to /sales — today's list shows the bill as VOID.
6. Go to /reports — totals exclude voided bill; low-stock panel renders.
7. In Supabase Table Editor, verify product's stock is back to original (void restored).

- [ ] **Step 4: Final commit (if any cleanup needed)**

If any fixups required, commit them:
```bash
git add -A
git commit -m "chore: e2e verification fixes"
```

Otherwise, move on.

---

## Open risks / follow-ups (not in scope)

- Offline support: if owner loses connectivity mid-cart, no local persistence. Future enhancement: `localStorage` draft.
- Tax math: GST number displays; no CGST/SGST split. Add when owner asks.
- Barcode scanner: mobile camera-scan shortcut for product-picker. Future enhancement.
- Payment method field: when owner needs to reconcile cash vs UPI.
- Daily close / cash-up report: separate end-of-day summary.
