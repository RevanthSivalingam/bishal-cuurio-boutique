# Bishal Cuurio Boutique

Mobile-first shop management app for a small return-gift and decor-rental boutique. Built to run **100% free** on Vercel + Supabase.

**Two audiences, one app:** a public catalog (`/`, `/product/[id]`) customers browse and select items from to enquire via WhatsApp — no accounts, no online checkout (planned for a future phase) — and a signed-in admin suite for inventory, POS billing with PDF invoices, end-of-day stock adjustment, and sales/profit reporting.

## Stack

- Next.js 16 App Router + TypeScript
- Tailwind CSS v4 + custom shadcn-style primitives
- Supabase (Postgres + Auth + Storage) — free tier
- TanStack Query, react-hook-form + zod

## One-time setup

### 1. Create a Supabase project

1. Go to <https://supabase.com> → New project (free tier).
2. Wait ~2 min for provisioning.
3. **Project Settings → API** → copy `Project URL` and `anon public` key.

### 2. Configure env

```bash
cp .env.example .env.local
# Open .env.local and paste the URL + anon key from step 1.
```

### 3. Run schema

1. Supabase Dashboard → **SQL Editor** → New query.
2. Paste contents of `schema.sql` → **Run**.

### 4. Create storage bucket

1. Supabase Dashboard → **Storage** → New bucket.
2. Name: `product-images`. **Public: ON**. Create.
3. SQL Editor → run the four `storage.objects` policies listed at the bottom of `schema.sql`.

### 5. Create your login

Supabase Dashboard → **Authentication → Users → Add user → Create new user** (email + password). That's your shop login.

## Run locally

```bash
npm install      # already done if you just cloned
npm run dev      # http://localhost:3000
```

### Use it on your phone (same WiFi)

```bash
# find your Mac/PC's local IP
ipconfig getifaddr en0      # macOS
# (Windows: run `ipconfig`, look for IPv4)

# start dev server listening on all interfaces
npm run dev -- -H 0.0.0.0

# on your phone browser: http://<your-local-ip>:3000
```

## Deploy to Vercel (free)

1. Push this repo to GitHub.
2. <https://vercel.com> → **Import Project** → select your repo.
3. Add env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) in Vercel project settings.
4. Deploy. Done — you'll get a public HTTPS URL usable from any phone.

## File map

```text
app/
  layout.tsx                 shell: theme script, query provider
  page.tsx                   public catalog (storefront home)
  product/[id]/page.tsx      public product detail
  login/page.tsx             email+password sign-in
  inventory/                 admin: product CRUD
    layout.tsx, page.tsx, inventory-grid.tsx, new/page.tsx, [id]/edit/page.tsx
  categories/                admin: category CRUD
  sales/                     admin: POS billing
    page.tsx                 bill history, filters, pagination
    new/page.tsx             checkout / cart
    [id]/page.tsx            bill view, PDF, void, duplicate
  stock/                     admin: end-of-day stock adjustment + audit log
  reports/                   admin: sales/profit dashboard
components/
  ui/*                       button, input, label, card, select, badge, skeleton, empty-state
  admin-layout.tsx           shared admin page shell
  top-nav.tsx                sticky header + mobile drawer nav
  category-chips.tsx         shared category filter chips (storefront + admin)
  catalog-grid.tsx / catalog-card.tsx     public catalog grid + card
  product-card.tsx / product-form.tsx    admin inventory grid card + form
  product-picker.tsx         search-to-add combobox (sales/new, stock)
  enquire-button.tsx         single-item WhatsApp enquiry
  share-buttons.tsx          native share
  bill-pdf.ts                jsPDF bill generation
  sparkline.tsx              tiny inline chart for reports
  theme-toggle.tsx           light/dark toggle
  query-provider.tsx         TanStack Query client provider
lib/
  supabase/client.ts, server.ts   Supabase clients
  sales.ts                   sale/bill/stock RPC wrappers
  availability.ts            stock-status labels ("One of a kind", "Only N left")
  money.ts                   INR formatting + margin calc
  schemas.ts                 zod schemas
  utils.ts                   cn() helper
proxy.ts                     auth redirect (Next 16 renamed from middleware)
schema.sql                   paste into Supabase SQL editor
```
