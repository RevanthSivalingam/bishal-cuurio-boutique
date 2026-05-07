# Sales Tracking & Billing — Design Spec

**Date:** 2026-05-07
**Status:** Approved, pending implementation plan
**Author:** brainstorming session with Claude

## Purpose

Add daily sales tracking, multi-item billing with PDF generation, automatic stock decrement, and sales/profit reporting to the existing boutique inventory app.

## Success criteria

- Owner records multi-line sales on mobile in under 30 seconds per bill.
- Product stock updates automatically and atomically on sale and void.
- Customer receives a PDF bill (download, shareable via WhatsApp/email).
- Owner can view daily totals and date-range profit reports.
- All operations respect per-owner RLS — owners cannot see each other's data.

## Non-goals (YAGNI)

- Tax/GST computation.
- Multi-currency support (assumes single currency, ₹).
- Customer CRM / repeat-buyer tracking (customer name/phone are per-bill free-text).
- Payment method tracking (cash/UPI/card).
- Partial returns or line-item voids (whole-bill void only).
- Inventory transfers, purchase orders, vendor tracking.

## Data model

### New table: `sales`

```sql
create table sales (
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

create index sales_owner_created_idx on sales (owner_id, created_at desc);
create index sales_status_idx on sales (owner_id, status);
```

### New table: `sale_items`

```sql
create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references sales(id) on delete cascade not null,
  product_id uuid references products(id) on delete set null,
  product_name text not null,            -- snapshot
  unit_bought_price numeric(10,2) not null, -- snapshot for profit calc
  unit_sell_price numeric(10,2) not null,   -- actual price charged
  quantity integer not null check (quantity > 0),
  line_total numeric(10,2) generated always as (unit_sell_price * quantity) stored
);

create index sale_items_sale_idx on sale_items (sale_id);
create index sale_items_product_idx on sale_items (product_id);
```

**Why snapshot prices/names:** bills are immutable business records. If a product is renamed or its price changes later, historical bills must still reflect what was actually sold.

### Bill numbering

Per-owner, yearly-reset, sequential: `B-2026-0001`, `B-2026-0002`, ...

```sql
create table bill_counters (
  owner_id uuid references auth.users(id) on delete cascade,
  year integer,
  counter integer not null default 0,
  primary key (owner_id, year)
);
```

Incremented inside the `create_sale` RPC using `insert ... on conflict update returning counter`, guaranteeing no gaps or duplicates under concurrency.

### RPCs (Postgres functions)

**`create_sale(items jsonb, discount_pct numeric, customer_name text, customer_phone text) returns sales`**

- Begins transaction.
- Locks each product row (`select ... for update`) to prevent overselling.
- Validates each item has sufficient stock; raises exception if not.
- Computes subtotal, discount_amount, total.
- Increments `bill_counters` for (owner_id, current_year), generates `bill_number`.
- Inserts `sales` row.
- Inserts `sale_items` rows with snapshot prices/names from products table.
- Decrements `products.stock` for each line.
- Returns the created `sales` row.

**`void_sale(sale_id uuid) returns sales`**

- Validates: sale belongs to caller (RLS), status = 'active', `created_at >= now() - interval '24 hours'`.
- Sets `status='void'`, `voided_at=now()`.
- Restores `products.stock` for each line item (if product still exists).
- Returns updated `sales` row.

### RLS policies

```sql
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table bill_counters enable row level security;

-- sales: owner-only read/write
create policy "owner reads own sales" on sales for select using (auth.uid() = owner_id);
create policy "owner writes own sales" on sales for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- sale_items: access via parent sale
create policy "owner reads own sale_items" on sale_items for select
  using (exists (select 1 from sales where sales.id = sale_items.sale_id and sales.owner_id = auth.uid()));
create policy "owner writes own sale_items" on sale_items for all
  using (exists (select 1 from sales where sales.id = sale_items.sale_id and sales.owner_id = auth.uid()))
  with check (exists (select 1 from sales where sales.id = sale_items.sale_id and sales.owner_id = auth.uid()));

-- bill_counters: owner-only
create policy "owner manages own counters" on bill_counters for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
```

## UI & routes

### New routes

| Route | Purpose |
| --- | --- |
| `/sales` | List bills. Default: today. Date filter + status filter (all/active/void). |
| `/sales/new` | Multi-line cart, checkout. |
| `/sales/[id]` | Single bill view. Download PDF. Void button (if within 24h). |
| `/reports` | Date range picker, sales/profit totals, top products, low-stock warning. |

### Top nav

Add "Sales" and "Reports" items next to existing "Inventory" in [components/top-nav.tsx](../../components/top-nav.tsx).

### New bill flow (`/sales/new`)

1. **Product picker** — type-ahead search input. Shows name, current stock, default selling price. Click/tap adds to cart.
2. **Cart table/cards** — responsive. Columns: product name, qty stepper (±), unit price (editable, defaults to product's selling_price), line total, remove button.
3. **Totals card** — subtotal (sum of line_totals), discount % input (0–100), discount ₹ shown, **grand total**.
4. **Customer section** (collapsible) — optional name, phone.
5. **Checkout button** — calls `create_sale` RPC. On success: redirect to `/sales/[id]`. On error (insufficient stock, network): show inline error, cart state preserved.

### Bill view (`/sales/[id]`)

- Shop header — shop name from `NEXT_PUBLIC_SHOP_NAME` env var, fallback to "Boutique".
- Bill number, timestamp, status badge (red if void).
- Line items table.
- Totals breakdown.
- Customer info (if present).
- **Download PDF** button — generates client-side via `jspdf`.
- **Void** button — shown only if status='active' AND within 24h. Opens confirm dialog.

### Reports (`/reports`)

- Date range picker (default: current month).
- Summary cards: total sales ₹, total profit ₹, bill count, items sold.
- Top 5 products by quantity sold in range.
- Low-stock warning panel (products where `stock <= low_stock_threshold`).
- All metrics exclude voided bills.

### Mobile responsiveness

Cart table collapses to stacked cards on narrow viewports. Reuse existing Tailwind patterns from [components/product-form.tsx](../../components/product-form.tsx).

## PDF generation

**Library:** `jspdf` (~45KB min+gzip).

**Layout (A4 portrait):**

- Header block: shop name from `NEXT_PUBLIC_SHOP_NAME` (large), bill number, date/time.
- Customer block (if present).
- Items table: name, qty, unit price, line total.
- Totals block: subtotal, discount (if > 0), grand total (bold, large).
- Footer: "Thank you" or similar.

**Trigger:** client-side button click. No server round-trip. File downloaded as `bill-<bill_number>.pdf`.

## Concurrency & correctness

- `create_sale` RPC uses `SELECT ... FOR UPDATE` on product rows — prevents two simultaneous checkouts from overselling.
- Bill numbers generated inside the same transaction via `bill_counters` upsert — guarantees no gaps or duplicates.
- Void is atomic: status change + stock restore in one transaction.
- Profit calc uses snapshot `unit_bought_price` — accurate even if product's `bought_price` changes later.

## Error handling

| Scenario | Behavior |
| --- | --- |
| Insufficient stock at checkout | RPC raises exception; UI shows "Only N left of {product}", cart preserved |
| Product deleted between add-to-cart and checkout | RPC raises FK exception; UI shows "Product no longer available" |
| Network failure during checkout | UI shows retry button, cart preserved in local state |
| Void attempted > 24h after creation | RPC raises exception; UI greys out void button preemptively |
| Void of already-voided bill | RPC raises exception (status check) |

## New dependencies

- `jspdf` — PDF generation (only runtime dep addition).
- Date range picker: use native `<input type="date">` pair. No library needed. Format via `Intl.DateTimeFormat`.

## Files to add/modify

### New files

- `app/sales/page.tsx` — bill list
- `app/sales/new/page.tsx` — cart + checkout
- `app/sales/[id]/page.tsx` — bill view
- `app/reports/page.tsx` — reports dashboard
- `components/product-picker.tsx` — type-ahead search
- `components/cart.tsx` — cart table/cards
- `components/bill-pdf.ts` — jspdf wrapper
- `components/void-dialog.tsx` — confirm dialog
- `lib/sales.ts` — RPC client wrappers, profit helpers
- `components/ui/dialog.tsx` — if not already present

### Modified files

- `schema.sql` — append sales tables, RPCs, RLS policies, bill_counters
- `lib/schemas.ts` — add zod schemas: `cartItemSchema`, `createSaleSchema`, etc.
- `components/top-nav.tsx` — add Sales/Reports nav items
- `package.json` — add `jspdf`

## Testing approach

- Manual: record a bill, verify stock decrement, download PDF, void, verify stock restore.
- Edge cases: zero-qty guard, negative discount guard, stock race (simulate via two browser tabs).
- RLS verification: second test account cannot see first account's sales.
- Reports: verify profit matches hand-calculated expected values on a small seeded dataset.

## Out-of-scope improvements noted

The existing codebase is small and clean. No refactoring needed alongside this feature.

## Open questions resolved during brainstorming

- Multi-line cart: **yes** (multi-item bills per transaction).
- Price override: **yes**, plus bill-level percentage discount.
- Bill output: **PDF download** via jspdf.
- Voids + reporting: **full** — voids within 24h, daily summary, date-range reports with profit.
