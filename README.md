# Return-Gift Shop — Inventory v1

Mobile-friendly inventory manager for a small return-gift shop. Built to run **100% free** on Vercel + Supabase.

**v1 scope:** inventory CRUD with auto-calculated margins and image uploads.
Phase 2 (later): POS billing, GST PDF invoice, WhatsApp share, dashboard.

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
  layout.tsx                 shell, mobile top bar
  page.tsx                   redirects to /inventory
  login/page.tsx             email+password sign-in
  inventory/
    layout.tsx               inventory shell (top nav)
    page.tsx                 grid of products, search, category filter
    inventory-grid.tsx       client grid w/ filters
    new/page.tsx             add product
    [id]/edit/page.tsx       edit / delete product
components/
  ui/*                       button, input, label, card, select, badge
  top-nav.tsx                sticky header + sign-out
  product-card.tsx           tile w/ image, stock badge, margin %
  product-form.tsx           shared add/edit form + live margin preview
  image-upload.tsx           tap-to-upload image (camera-friendly)
lib/
  supabase/client.ts         browser Supabase client
  supabase/server.ts         server Supabase client (cookies)
  money.ts                   INR formatting + margin calc
  schemas.ts                 zod schemas for Product
  utils.ts                   cn() helper
proxy.ts                     auth redirect (Next 16 renamed from middleware)
schema.sql                   paste into Supabase SQL editor
```
