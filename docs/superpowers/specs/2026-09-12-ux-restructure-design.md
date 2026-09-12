# UX Restructure, Customer Selection & Brand Integration — Design Spec

**Date:** 2026-09-12
**Status:** Approved, pending implementation plan
**Author:** brainstorming session with Claude

## Purpose

Three things, none of which touch the core data model:

1. Give customers a lightweight way to select multiple catalog items and hand that list to the shop via WhatsApp — without building full checkout/ordering.
2. Clean up existing UI/UX debt (a theming-mechanism conflict, duplicated components, stale docs) without a wholesale redesign.
3. Integrate the shop's new logo and real brand colors, which didn't exist when the current storefront look was built.

## Success criteria

- Customer can select any number of catalog items across categories/pages and send one combined WhatsApp message to the shop in roughly 3 taps (select, select, share).
- Selection state survives closing the browser tab.
- No new backend tables/endpoints — selection lives entirely client-side.
- Dark-mode/contrast bugs across admin screens stop recurring, because there's exactly one theming mechanism instead of two fighting each other.
- Admin pages (sales/stock/reports/categories/inventory) share one loading/error pattern via `react-query` instead of five hand-rolled ones.
- The shop's real logo appears in the header, favicon, and login page — no more generic placeholder identity.
- Pinch-to-zoom works again on mobile.

## Non-goals (YAGNI) — explicit, so scope doesn't creep back in

- No cart/checkout/payment/orders table — real online ordering is next phase.
- No staff roles or multi-user permissions — single owner login stays as the only login.
- No customer accounts, login, or CRM.
- No rental-specific logic (dates, deposits, availability) for "Decor Rentals" — it's just another product category, sold/browsed identically to gift items.
- No unifying the storefront and admin visual identity — two distinct skins (customer-facing "Vitrine" boutique look vs. plain functional admin) stay intentionally separate.
- No rewrite of the `components/ui/` primitives — only the theming mechanism underneath changes.
- No GST/tax math, multi-currency, or purchase-order/vendor tracking (already non-goals in the sales-tracking spec; still holds).

## A. Customer selection → WhatsApp

### Interaction model

- Cart-style floating bar pattern (reuses the `env(safe-area-inset-bottom)` pattern from the existing checkout bar in `app/sales/new`).
- Each product card (catalog grid + product detail page) gets a select toggle (+ / ✓) alongside — not replacing — the existing single-item "Enquire" button. Enquire is "ask about just this one now"; selection is "build a list, send together."
- A `SelectionBar` appears fixed at the bottom once selection isn't empty: "N selected · Share via WhatsApp".
- No quantity — selected or not. Tap again to remove.

### State

- Client-side only. `localStorage`-backed, array of lightweight snapshots: `{ id, name, price, slug }` — enough to render the bar and build the message without refetching.
- Persists across sessions (survives closing the tab). Does not auto-clear after sharing — customer can keep browsing, add more, and re-share an updated list. Clears only when items are individually removed or "Clear all" is tapped.

### Share

- Tapping Share builds a `wa.me` deep link to the shop's WhatsApp number (same number/mechanism the existing single-item Enquire button already uses) with a pre-filled message:

  ```
  Hi! I'm interested in these:

  1. Brass Vase — ₹450
  yourshop.com/product/12

  2. Ceramic Lamp — ₹1,200
  yourshop.com/product/8

  2 items total
  ```

- Goes straight to the shop's chat (not the native share sheet) — one tap, no picking a contact.

### Data/backend

- None. No new Supabase table, no new RPC, no new route. Purely a new client component plus a small selection-state helper module.

## B. Admin & design-system cleanup

### Theming mechanism

- Root cause of the recurring dark-mode bugs: two theming systems doing overlapping work — semantic CSS vars (`--surface`, `--border`, etc., defined in `globals.css`) *and* raw Tailwind `dark:zinc-*` utility pairs scattered through admin pages.
- Fix: extend the semantic-var approach (already used correctly on the storefront) to admin screens, replacing the raw `dark:` pairs. Same visual colors — just one mechanism, so a contrast bug can't be introduced by one code path while the other stays correct.

### Component dedup

- Merge `components/catalog-grid.tsx` and `app/inventory/inventory-grid.tsx` (and their separate `Chip`/`CategoryChip` components) into one shared grid component, parameterized by variant (customer vs. admin styling). Removes the class of bug where a fix (e.g. the dark-mode chip contrast fix) has to be applied twice.
- Consolidate the five near-identical `layout.tsx` admin wrappers (`inventory`, `sales`, `stock`, `reports`, `categories`) into one `AdminLayout` component taking a `maxWidth` prop.

### Data fetching

- Adopt the already-installed-but-unused `@tanstack/react-query` across the admin pages that currently hand-roll `useState`/`useEffect` loading/error state (sales, stock, reports, categories, inventory). Gives consistent loading/error/retry behavior everywhere instead of five slightly different implementations.

### Accessibility

- Remove `maximumScale: 1` from the viewport config — restores pinch-to-zoom.

### Docs

- Refresh `README.md` — it still frames the app as "v1 inventory-only, Phase 2 later" when Phase 2 (sales, billing, PDF, reports) is already built.

## C. Brand integration

### Assets

Already prepared, staged in `public/branding/`, **not yet wired into any code**:

- `logo-full.png` — 700px wide, transparent background, for header nav and login page.
- `logo-full-highres.png` — full-resolution transparent master, for PDF bill headers.
- `logo-mark.png` — emblem only (no wordmark), for favicon use.
- `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png` — generated from the mark.
- Colors extracted from the artwork: maroon `#611E20`, brass gold `#C9A24C`, cream `#FDF8F3`.

### Where it goes (implementation-time, not yet done)

- Header/nav: place `logo-full.png` alongside or in place of the text wordmark.
- Favicon + apple touch icon: wire via Next's file-based icon convention — **check this project's Next 16 docs (`node_modules/next/dist/docs/`) before editing**, per `AGENTS.md`; icon conventions may differ from familiar Next.js.
- Login page: show the logo above the sign-in form.
- Storefront accent color: retune the customer-facing "Vitrine" skin's accent from its current generic amber/brass to the logo's actual maroon (`#611E20`), so buttons/links tie back to the real brand mark. **Admin's functional zinc palette is untouched** — this only affects the customer-facing skin, consistent with keeping two distinct skins (§ Non-goals).
- PDF bill header: add the high-res logo to the top of generated bills. Lower priority than the other three.

## Error handling

- Selection state: if `localStorage` is unavailable (private browsing, quota exceeded), selection falls back to in-memory only for that session — no error shown to the customer, it just doesn't persist across reloads.
- WhatsApp share: if the shop's WhatsApp number isn't configured, the Share button behaves the same way the existing Enquire button already handles that case today — no new failure mode to design.

## Testing

- Selection add/remove/persist logic: unit tests (vitest) for the selection-state helpers, mirroring the existing `lib/sales.test.ts` pattern.
- Message-builder function: unit test for correct formatting with 1 item, multiple items, and special characters in product names (URL-encoding correctness).
- Manual mobile check: real-phone test of the floating bar (thumb reach, safe-area padding) and the WhatsApp handoff, same as the existing "test on your phone over local WiFi" workflow in the README.
