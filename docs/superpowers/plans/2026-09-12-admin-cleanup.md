# Admin & Design-System Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the two-theming-systems bug at its root (semantic CSS vars vs. raw Tailwind `dark:zinc-*` pairs), dedupe the catalog/inventory grid and the five near-identical admin layouts, adopt the already-installed-but-unused `@tanstack/react-query` across the admin data pages, fix a real accessibility regression (`maximumScale: 1`), and refresh the stale README.

**Architecture:** No backend/data-model changes. This plan touches: the shared `components/ui/` primitives (converting their neutral colors to the existing semantic CSS var tokens), a new shared `AdminLayout` and `CategoryChips` component (replacing five duplicated layouts and two duplicated chip implementations), and four admin pages migrated from hand-rolled `useState`/`useEffect` data fetching to `@tanstack/react-query`.

**Tech Stack:** Next.js 16 (App Router), Tailwind v4 CSS custom properties, `@tanstack/react-query` v5 (already a dependency, not yet wired up), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-12-ux-restructure-design.md` (§ B. Admin & design-system cleanup)

## Global Constraints

- No new Supabase tables, RPCs, or routes.
- Semantic tokens already exist in `app/globals.css` and must be reused, not reinvented: `bg-background`, `text-foreground`, `bg-surface`, `bg-surface-muted`, `text-muted-foreground`, `border-border`. (`bg-brand`/`text-brand` exist too but are unused dead CSS — leave them alone, out of scope here.)
- **Only neutral/chrome colors are in scope** (borders, surfaces, default text). Intentional semantic status-color pairs — `emerald` (success), `red` (danger/void), `amber` (warning/offline) — already correctly define both light and dark variants at each call site and must **not** be touched; they are not the bug this plan fixes.
- Admin's `variant="brand"` button (hardcoded emerald, used only on `/sales*` and `/stock`) stays exactly as-is — confirmed independent of every token this plan changes.
- `components/ui/` primitives keep their existing props/API — only their internal Tailwind classes change (matches the spec's non-goal: "no rewrite of the primitives, only the theming mechanism underneath").
- Every task must be verified in **both** light and dark mode (toggle via the existing `ThemeToggle`).

---

### Task 1: Fix pinch-to-zoom accessibility regression

**Files:**
- Modify: `app/layout.tsx:19-27`

- [ ] **Step 1: Remove `maximumScale`**

  Change:
  ```ts
  export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    themeColor: [
  ```
  to:
  ```ts
  export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    themeColor: [
  ```

- [ ] **Step 2: Verify**

  Run `npm run dev`, open any page on a real phone (or Chrome DevTools device emulation), confirm pinch-to-zoom now works. No automated test applies to a viewport meta value.

- [ ] **Step 3: Commit**

  ```bash
  git add app/layout.tsx
  git commit -m "fix: restore pinch-to-zoom by removing maximumScale"
  ```

---

### Task 2: Migrate `components/ui/` primitives to semantic theming tokens

**Files:**
- Modify: `components/ui/button.tsx`, `components/ui/card.tsx`, `components/ui/label.tsx`, `components/ui/empty-state.tsx`, `components/ui/badge.tsx`, `components/ui/select.tsx`, `components/ui/input.tsx`

**Interfaces:**
- No prop/API changes to any of these components — same variants, same usage everywhere they're already imported.

While auditing these files two small pre-existing dark-mode bugs turned up (not from the spec, found while reading the code): `Badge`'s `info` variant has no dark-mode pair at all (`bg-blue-100 text-blue-700`, unreadable on a dark background), and `Input`'s placeholder color (`placeholder:text-zinc-400`) has no dark-mode pair either. Both are fixed as part of this token migration, since the semantic tokens fix them for free.

- [ ] **Step 1: `components/ui/button.tsx`**

  Change the `primary`, `secondary`, `outline`, `ghost` variants and the shared focus ring. Leave `brand` and `danger` untouched.

  ```tsx
  const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground disabled:opacity-50 disabled:pointer-events-none select-none",
    {
      variants: {
        variant: {
          primary: "bg-foreground text-background hover:opacity-90 active:opacity-80",
          brand:
            "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:active:bg-emerald-300",
          secondary: "bg-surface-muted text-foreground hover:opacity-80 active:opacity-70",
          outline: "border border-border bg-surface text-foreground hover:bg-surface-muted",
          ghost: "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
          danger:
            "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 dark:bg-red-500 dark:hover:bg-red-400",
        },
        size: {
          sm: "h-9 px-3 text-sm",
          md: "h-11 px-4 text-base",
          lg: "h-12 px-6 text-base",
          icon: "h-11 w-11",
        },
      },
      defaultVariants: { variant: "primary", size: "md" },
    }
  );
  ```

- [ ] **Step 2: `components/ui/card.tsx`**

  Change:
  ```tsx
  "rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden"
  ```
  to:
  ```tsx
  "rounded-xl border border-border bg-surface shadow-sm overflow-hidden"
  ```

- [ ] **Step 3: `components/ui/label.tsx`**

  Change:
  ```tsx
  "text-sm font-medium text-zinc-700 dark:text-zinc-300 select-none"
  ```
  to:
  ```tsx
  "text-sm font-medium text-foreground select-none"
  ```

- [ ] **Step 4: `components/ui/empty-state.tsx`**

  Change:
  ```tsx
        <div className="size-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <Icon className="size-7 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-medium text-base">{title}</h2>
          {description && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">{description}</p>
          )}
        </div>
  ```
  to:
  ```tsx
        <div className="size-14 rounded-full bg-surface-muted flex items-center justify-center">
          <Icon className="size-7 text-muted-foreground" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-medium text-base">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
          )}
        </div>
  ```

- [ ] **Step 5: `components/ui/badge.tsx`** (fixes the missing dark-mode `info` pair)

  Change:
  ```tsx
        neutral: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300",
        success: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400",
        warning: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200",
        danger: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
        info: "bg-blue-100 text-blue-700",
  ```
  to:
  ```tsx
        neutral: "bg-surface-muted text-foreground",
        success: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400",
        warning: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200",
        danger: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
        info: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  ```

- [ ] **Step 6: `components/ui/select.tsx`**

  Change:
  ```tsx
        "flex h-11 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-base text-zinc-900 dark:text-zinc-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-100 focus-visible:border-transparent",
  ```
  to:
  ```tsx
        "flex h-11 w-full rounded-lg border border-border bg-surface px-3 text-base text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:border-transparent",
  ```

- [ ] **Step 7: `components/ui/input.tsx`** (fixes the missing dark-mode placeholder pair)

  Change:
  ```tsx
        "flex h-11 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-base",
        "placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:border-transparent",
  ```
  to:
  ```tsx
        "flex h-11 w-full rounded-lg border border-border bg-surface px-3 py-2 text-base text-foreground",
        "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:border-transparent",
  ```

- [ ] **Step 8: Manually verify**

  Run `npm run dev`. Visit `/login` (Button, Input, Card, Label all appear there), `/categories` (Badge-free but has Input/Button), and `/inventory` (Badge via stock status, if used — otherwise check `/sales/[id]` for badges). Toggle dark mode on each. Confirm: no visual regressions, the `info` badge (if any call site uses it — grep `variant="info"` to find one, or skip if none exist yet) now has proper dark contrast, and input placeholders are legible in dark mode.

  This is a pure CSS-class change with no branching logic, so there's no automated test to write — visual verification across light/dark is the correct check here, consistent with Plan 1's approach to the same class of change.

- [ ] **Step 9: Commit**

  ```bash
  git add components/ui/
  git commit -m "fix: migrate ui primitives to semantic theming tokens, fix 2 missing dark-mode pairs"
  ```

---

### Task 3: Consolidate the five admin layouts into one `AdminLayout`

**Files:**
- Create: `components/admin-layout.tsx`
- Modify: `app/inventory/layout.tsx`, `app/sales/layout.tsx`, `app/stock/layout.tsx`, `app/reports/layout.tsx`, `app/categories/layout.tsx`

**Interfaces:**
- Produces: `AdminLayout({ children, maxWidth? }: { children: React.ReactNode; maxWidth?: "sm" | "md" | "lg" })`, default `"lg"`.

All five files are identical except the `max-w-*` class on `<main>`: inventory/sales/reports use `max-w-5xl` ("lg"), stock uses `max-w-4xl` ("md"), categories uses `max-w-3xl` ("sm").

- [ ] **Step 1: Create the shared layout**

  ```tsx
  import { TopNav } from "@/components/top-nav";

  const MAX_WIDTH = {
    sm: "max-w-3xl",
    md: "max-w-4xl",
    lg: "max-w-5xl",
  } as const;

  type Props = {
    children: React.ReactNode;
    maxWidth?: keyof typeof MAX_WIDTH;
  };

  export function AdminLayout({ children, maxWidth = "lg" }: Props) {
    return (
      <>
        <TopNav />
        <main className={`flex-1 w-full ${MAX_WIDTH[maxWidth]} mx-auto px-4 py-4`}>
          {children}
        </main>
      </>
    );
  }
  ```

- [ ] **Step 2: Replace each of the five layout files**

  `app/inventory/layout.tsx`, `app/sales/layout.tsx`, `app/reports/layout.tsx` (all `maxWidth="lg"`, which is the default so it can be omitted):
  ```tsx
  import { AdminLayout } from "@/components/admin-layout";

  export default function InventoryLayout({ children }: { children: React.ReactNode }) {
    return <AdminLayout>{children}</AdminLayout>;
  }
  ```
  (rename the function per file — `SalesLayout`, `ReportsLayout` — the body is otherwise identical.)

  `app/stock/layout.tsx`:
  ```tsx
  import { AdminLayout } from "@/components/admin-layout";

  export default function StockLayout({ children }: { children: React.ReactNode }) {
    return <AdminLayout maxWidth="md">{children}</AdminLayout>;
  }
  ```

  `app/categories/layout.tsx`:
  ```tsx
  import { AdminLayout } from "@/components/admin-layout";

  export default function CategoriesLayout({ children }: { children: React.ReactNode }) {
    return <AdminLayout maxWidth="sm">{children}</AdminLayout>;
  }
  ```

- [ ] **Step 3: Manually verify**

  Visit all five routes (`/inventory`, `/sales`, `/stock`, `/reports`, `/categories`) while signed in. Confirm each still renders at the same width as before — this is a pure refactor, no visual change is expected. A width change on any one route means a `maxWidth` value was mismatched.

- [ ] **Step 4: Commit**

  ```bash
  git add components/admin-layout.tsx app/inventory/layout.tsx app/sales/layout.tsx app/stock/layout.tsx app/reports/layout.tsx app/categories/layout.tsx
  git commit -m "refactor: consolidate 5 duplicate admin layouts into one AdminLayout"
  ```

---

### Task 4: Unify the catalog/inventory grid's category chips and empty state

**Files:**
- Create: `components/category-chips.tsx`
- Modify: `components/catalog-grid.tsx`, `app/inventory/inventory-grid.tsx`

**Interfaces:**
- Produces: `CategoryChips({ categories, activeCategory, onSelect, counts?, totalCount?, variant }: Props)`. When `counts` is provided, each chip shows `"Name · N"` and categories with a zero count are hidden (matches `CatalogGrid`'s existing customer-facing behavior); when omitted, chips show plain names with no filtering (matches `InventoryGrid`'s current behavior, though Step 3 below deliberately upgrades it to always pass `counts` for consistency).
- `ProductCard` and `CatalogCard` are **not** touched or merged — they're different by design (admin needs edit affordances, customer needs Enquire/select) and stay as separate components.

- [ ] **Step 1: Create the shared chip component**

  ```tsx
  "use client";

  type Category = { id: string; name: string };

  type Props = {
    categories: Category[];
    activeCategory: string | null;
    onSelect: (id: string | null) => void;
    counts?: Map<string, number>;
    totalCount?: number;
    variant: "storefront" | "admin";
  };

  export function CategoryChips({
    categories,
    activeCategory,
    onSelect,
    counts,
    totalCount,
    variant,
  }: Props) {
    const visible = counts ? categories.filter((c) => (counts.get(c.id) ?? 0) > 0) : categories;

    return (
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-none">
        <Chip
          label={counts ? `All · ${totalCount ?? 0}` : "All"}
          active={activeCategory === null}
          onClick={() => onSelect(null)}
          variant={variant}
        />
        {visible.map((c) => (
          <Chip
            key={c.id}
            label={counts ? `${c.name} · ${counts.get(c.id) ?? 0}` : c.name}
            active={activeCategory === c.id}
            onClick={() => onSelect(c.id)}
            variant={variant}
          />
        ))}
      </div>
    );
  }

  function Chip({
    label,
    active,
    onClick,
    variant,
  }: {
    label: string;
    active: boolean;
    onClick: () => void;
    variant: "storefront" | "admin";
  }) {
    if (variant === "storefront") {
      return (
        <button
          type="button"
          onClick={onClick}
          className={`shrink-0 px-3 py-1.5 rounded-full text-sm border transition-colors tabular-nums ${
            active
              ? "bg-brass-deep text-white border-brass-deep dark:text-[#14130f]"
              : "bg-paper border-paper-edge text-mist hover:text-ink hover:border-brass"
          }`}
        >
          {label}
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={onClick}
        className={`shrink-0 px-3 h-9 rounded-full text-sm font-medium transition-colors tabular-nums ${
          active ? "bg-foreground text-background" : "bg-surface-muted text-foreground hover:opacity-80"
        }`}
      >
        {label}
      </button>
    );
  }
  ```

- [ ] **Step 2: Use it in `CatalogGrid`**

  Remove the inline `Chip` function (lines 104-126) and the chip-row JSX (lines 65-83), replacing the chip-row with:
  ```tsx
        <CategoryChips
          categories={categories}
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
          counts={countsByCategory}
          totalCount={products.length}
          variant="storefront"
        />
  ```
  Add `import { CategoryChips } from "@/components/category-chips";` at the top. The existing `countsByCategory` `useMemo` stays in `CatalogGrid` unchanged — it's data prep, not UI, and is now passed as the `counts` prop instead of being read directly inside the removed inline `Chip`.

- [ ] **Step 3: Use it in `InventoryGrid`, upgrading it to match (counts + hide-empty + shared `EmptyState`)**

  Add a `countsByCategory` `useMemo` (new — `InventoryGrid` didn't have this before):
  ```tsx
  const countsByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) {
      if (!p.category_id) continue;
      m.set(p.category_id, (m.get(p.category_id) ?? 0) + 1);
    }
    return m;
  }, [products]);
  ```

  Replace the manual empty-state block (the `if (products.length === 0) { ... }` block) with the shared component, matching what `CatalogGrid` already does:
  ```tsx
  if (products.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No products yet"
        description="Add your first product to start tracking stock and margins."
        action={
          <Link href="/inventory/new">
            <Button size="lg">
              <Plus className="size-4" />
              Add your first product
            </Button>
          </Link>
        }
      />
    );
  }
  ```

  Remove the inline `CategoryChip` function entirely and replace the chip-row JSX with:
  ```tsx
        <CategoryChips
          categories={categories}
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
          counts={countsByCategory}
          totalCount={products.length}
          variant="admin"
        />
  ```

  Update the two remaining raw-zinc lines in this file to semantic tokens: the search icon (`text-zinc-400 dark:text-zinc-500` → `text-muted-foreground`) and the "no products match" text (`text-zinc-500 dark:text-zinc-400` → `text-muted-foreground`).

  Add imports: `import { EmptyState } from "@/components/ui/empty-state";` and `import { CategoryChips } from "@/components/category-chips";`.

- [ ] **Step 4: Manually verify**

  Visit `/` (storefront) and `/inventory` (admin) in both light and dark mode. Confirm: chips still filter correctly on both pages, the admin grid now shows per-category counts and hides empty categories (this is a deliberate small upgrade, not just a refactor — inventory chips previously showed every category regardless of whether it had products), and the empty-inventory state (temporarily rename/hide products in a test project, or just visually inspect the JSX) renders via the shared `EmptyState` component.

  No automated test — this is UI composition with no new pure logic (the `countsByCategory` computation is a direct copy of `CatalogGrid`'s existing, already-untested version).

- [ ] **Step 5: Commit**

  ```bash
  git add components/category-chips.tsx components/catalog-grid.tsx app/inventory/inventory-grid.tsx
  git commit -m "refactor: extract shared CategoryChips, give admin grid counts + shared EmptyState"
  ```

---

### Task 5: Convert `top-nav.tsx` to semantic theming tokens

**Files:**
- Modify: `components/top-nav.tsx`

This is the last file with raw zinc `dark:` pairs for neutral chrome (11 occurrences). The scrim (`bg-black/40 dark:bg-black/60`) is intentionally left as-is — it's a one-off overlay treatment, not part of the two-systems bug.

- [ ] **Step 1: Replace the header bar classes**

  Change:
  ```tsx
        <header className="sticky top-0 z-30 bg-white/90 dark:bg-zinc-900/90 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
  ```
  to:
  ```tsx
        <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur border-b border-border">
  ```

- [ ] **Step 2: Replace the menu button classes**

  Change:
  ```tsx
            className="p-2 -ml-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 active:bg-zinc-200"
  ```
  to:
  ```tsx
            className="p-2 -ml-2 rounded-md hover:bg-surface-muted active:opacity-70"
  ```

- [ ] **Step 3: Replace the drawer panel classes**

  Change:
  ```tsx
        className={`fixed top-0 left-0 z-50 h-full w-72 max-w-[85vw] bg-white dark:bg-zinc-900 shadow-xl transition-transform duration-200 ease-out ${
  ```
  to:
  ```tsx
        className={`fixed top-0 left-0 z-50 h-full w-72 max-w-[85vw] bg-surface shadow-xl transition-transform duration-200 ease-out ${
  ```

- [ ] **Step 4: Replace the drawer header classes**

  Change:
  ```tsx
        <div className="flex items-center justify-between px-4 h-14 border-b border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-2 -ml-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
  ```
  to:
  ```tsx
        <div className="flex items-center justify-between px-4 h-14 border-b border-border">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-2 -ml-2 rounded-md hover:bg-surface-muted"
  ```

- [ ] **Step 5: Replace the nav-item classes**

  Change:
  ```tsx
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm ${
                  active
                    ? "bg-zinc-100 dark:bg-zinc-800 font-medium text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
  ```
  to:
  ```tsx
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm ${
                  active
                    ? "bg-surface-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-surface-muted"
                }`}
  ```

- [ ] **Step 6: Replace the footer border and sign-out/sign-in classes**

  Change:
  ```tsx
        <div className="border-t border-zinc-200 dark:border-zinc-800 mt-2 p-2">
          {authed === null ? null : authed ? (
            <button
              type="button"
              onClick={signOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <LogOut className="size-5" />
              Sign out
            </button>
          ) : (
            <Link
              href="/login"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
  ```
  to:
  ```tsx
        <div className="border-t border-border mt-2 p-2">
          {authed === null ? null : authed ? (
            <button
              type="button"
              onClick={signOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-muted-foreground hover:bg-surface-muted"
            >
              <LogOut className="size-5" />
              Sign out
            </button>
          ) : (
            <Link
              href="/login"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-muted-foreground hover:bg-surface-muted"
            >
  ```

- [ ] **Step 7: Manually verify**

  Open the header and mobile drawer (hamburger button) on any page, signed in and signed out, in both light and dark mode. Confirm the header background, drawer background, active/inactive nav item contrast, and hover states all still look correct — this is a pure color-token swap, no layout change.

- [ ] **Step 8: Commit**

  ```bash
  git add components/top-nav.tsx
  git commit -m "fix: migrate top-nav to semantic theming tokens"
  ```

---

### Task 6: Set up `QueryClientProvider` and migrate `/categories` to react-query

**Files:**
- Create: `components/query-provider.tsx`
- Modify: `app/layout.tsx`, `app/categories/page.tsx`

**Interfaces:**
- Produces: `AppQueryProvider({ children })`, mounted once at the root. Every later react-query task (7, 8, 9) depends on this being in place first.

`/categories` is the smallest of the four data-fetching admin pages, so it's the one that proves out the provider setup. It currently has **two** near-identical fetch blocks (a `load()` function and an almost-identical inline fetch inside `useEffect`) — collapsing both into one `useQuery` removes that duplication as a side effect.

- [ ] **Step 1: Create the query provider**

  ```tsx
  "use client";

  import { useState } from "react";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

  export function AppQueryProvider({ children }: { children: React.ReactNode }) {
    const [client] = useState(() => new QueryClient());
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  ```

- [ ] **Step 2: Mount it in the root layout**

  In `app/layout.tsx`, add the import:
  ```tsx
  import { AppQueryProvider } from "@/components/query-provider";
  ```
  Change:
  ```tsx
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
  ```
  to:
  ```tsx
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <AppQueryProvider>{children}</AppQueryProvider>
      </body>
  ```

- [ ] **Step 3: Rewrite `/categories`**

  Replace the full contents of `app/categories/page.tsx`:
  ```tsx
  "use client";

  import { useState } from "react";
  import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
  import { Plus, Pencil, Trash2, Check, X, Tags } from "lucide-react";
  import { createSupabaseBrowserClient } from "@/lib/supabase/client";
  import type { Category } from "@/lib/schemas";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { EmptyState } from "@/components/ui/empty-state";

  async function fetchCategories(): Promise<Category[]> {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.from("categories").select("id,name").order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as Category[];
  }

  export default function CategoriesPage() {
    const queryClient = useQueryClient();
    const {
      data: cats = [],
      isLoading,
      error,
    } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

    const [newName, setNewName] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [mutationError, setMutationError] = useState<string | null>(null);

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["categories"] });

    const createMutation = useMutation({
      mutationFn: async (name: string) => {
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.from("categories").insert({ name });
        if (error) throw new Error(error.message);
      },
      onSuccess: () => {
        setNewName("");
        setMutationError(null);
        invalidate();
      },
      onError: (e) => setMutationError(e instanceof Error ? e.message : "Save failed"),
    });

    const updateMutation = useMutation({
      mutationFn: async ({ id, name }: { id: string; name: string }) => {
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.from("categories").update({ name }).eq("id", id);
        if (error) throw new Error(error.message);
      },
      onSuccess: () => {
        setEditingId(null);
        setMutationError(null);
        invalidate();
      },
      onError: (e) => setMutationError(e instanceof Error ? e.message : "Save failed"),
    });

    const deleteMutation = useMutation({
      mutationFn: async (id: string) => {
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.from("categories").delete().eq("id", id);
        if (error) throw new Error(error.message);
      },
      onSuccess: () => {
        setMutationError(null);
        invalidate();
      },
      onError: (e) => setMutationError(e instanceof Error ? e.message : "Delete failed"),
    });

    const create = () => {
      const name = newName.trim();
      if (!name) return;
      createMutation.mutate(name);
    };

    const saveEdit = (id: string) => {
      const name = editName.trim();
      if (!name) return;
      updateMutation.mutate({ id, name });
    };

    const remove = (id: string) => {
      if (!confirm("Delete this category? Products in it will become uncategorised.")) return;
      deleteMutation.mutate(id);
    };

    const err = mutationError ?? (error instanceof Error ? error.message : null);

    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Categories</h1>

        <div className="flex gap-2">
          <Input
            placeholder="New category name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <Button onClick={create} disabled={createMutation.isPending || !newName.trim()}>
            <Plus className="size-4" />
            Add
          </Button>
        </div>

        {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

        <ul className="flex flex-col gap-2">
          {cats.map((c) => (
            <li key={c.id} className="flex items-center justify-between border border-border rounded-xl px-3 py-2">
              {editingId === c.id ? (
                <div className="flex gap-2 w-full">
                  <Input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveEdit(c.id)}
                  />
                  <Button size="sm" onClick={() => saveEdit(c.id)}>
                    <Check className="size-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <span>{c.name}</span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(c.id);
                        setEditName(c.name);
                      }}
                      aria-label="Edit"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(c.id)} aria-label="Delete">
                      <Trash2 className="size-4 text-red-600 dark:text-red-400" />
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>

        {!isLoading && cats.length === 0 && (
          <EmptyState
            icon={Tags}
            title="No categories yet"
            description="Add your first category above to start grouping products in the catalog."
          />
        )}
      </div>
    );
  }
  ```

- [ ] **Step 4: Manually verify**

  Run `npm run dev`, visit `/categories`. Confirm: the list loads, add/edit/delete all still work exactly as before (same confirm() dialog on delete, same inline edit UX), and the error/loading states render correctly. This behavior is identical to before the refactor — no automated test is added because no new pure logic was introduced (the Supabase calls are thin `mutationFn`/`queryFn` wrappers, and `lib/sales.ts`-style pure functions aren't involved on this page).

- [ ] **Step 5: Commit**

  ```bash
  git add components/query-provider.tsx app/layout.tsx app/categories/page.tsx
  git commit -m "feat: wire up react-query provider, migrate /categories off manual fetch state"
  ```

---

### Task 7: Migrate `/reports` to react-query

**Files:**
- Modify: `app/reports/page.tsx`

**Interfaces:**
- Consumes: `AppQueryProvider` from Task 6 (already mounted at the root).

- [ ] **Step 1: Rewrite the page**

  Replace the full contents of `app/reports/page.tsx`:
  ```tsx
  "use client";

  import { useMemo, useState } from "react";
  import { useQuery } from "@tanstack/react-query";
  import { createSupabaseBrowserClient } from "@/lib/supabase/client";
  import { fetchReportData, computeProfit } from "@/lib/sales";
  import type { Sale, SaleItem, Product } from "@/lib/schemas";
  import { Input } from "@/components/ui/input";
  import { Skeleton } from "@/components/ui/skeleton";
  import { Sparkline } from "@/components/sparkline";
  import { formatINR } from "@/lib/money";

  const startOfMonthISO = () => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  };
  const todayISO = () => new Date().toISOString().slice(0, 10);

  function bucketByDay(sales: Sale[], from: string, to: string): number[] {
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    const buckets = new Array(days).fill(0) as number[];
    for (const s of sales) {
      const t = new Date(s.occurred_at);
      const d = Math.floor((t.getTime() - start.getTime()) / 86400000);
      if (d >= 0 && d < days) buckets[d] += s.total;
    }
    return buckets;
  }

  async function fetchReport(from: string, to: string) {
    const supabase = createSupabaseBrowserClient();
    const fromIso = new Date(`${from}T00:00:00`).toISOString();
    const toIso = new Date(`${to}T23:59:59.999`).toISOString();
    const [report, low] = await Promise.all([
      fetchReportData(supabase, fromIso, toIso),
      supabase.from("products").select("*").order("stock", { ascending: true }),
    ]);
    if (low.error) throw new Error(low.error.message);
    const prods = (low.data ?? []) as Product[];
    return {
      sales: report.sales,
      items: report.items,
      lowStock: prods.filter((p) => p.stock <= p.low_stock_threshold),
    };
  }

  export default function ReportsPage() {
    const [from, setFrom] = useState(startOfMonthISO());
    const [to, setTo] = useState(todayISO());

    const { data, isLoading } = useQuery({
      queryKey: ["reports", from, to],
      queryFn: () => fetchReport(from, to),
    });
    const sales = data?.sales ?? [];
    const items = data?.items ?? [];
    const lowStock = data?.lowStock ?? [];
    const loading = isLoading;

    const totalSales = sales.reduce((s, x) => s + x.total, 0);
    const totalProfit = computeProfit(items);
    const itemsSold = items.reduce((s, x) => s + x.quantity, 0);
    const daily = useMemo(() => bucketByDay(sales, from, to), [sales, from, to]);

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
      <div className="max-w-3xl mx-auto flex flex-col gap-5">
        <h1 className="text-3xl font-[family-name:var(--font-display)] font-semibold tracking-tight">
          Reports
        </h1>

        <div className="flex gap-2 flex-wrap items-center">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
          <span className="text-muted-foreground text-sm">to</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
        </div>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[70px] rounded-xl" />)
          ) : (
            <>
              <StatCard label="Sales" value={formatINR(totalSales)} />
              <StatCard label="Profit" value={formatINR(totalProfit)} emphasis />
              <StatCard label="Bills" value={String(sales.length)} />
              <StatCard label="Items sold" value={String(itemsSold)} />
            </>
          )}
        </section>

        <section className="rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Daily sales</h2>
            <span className="text-xs text-muted-foreground">
              {daily.length} {daily.length === 1 ? "day" : "days"}
            </span>
          </div>
          {loading ? (
            <Skeleton className="h-[60px]" />
          ) : totalSales === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No sales in this range yet.</p>
          ) : (
            <Sparkline values={daily} height={60} aria-label="Daily sales trend for the selected range" />
          )}
        </section>

        <section>
          <h2 className="font-medium mb-2">Top products</h2>
          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8" />
              ))}
            </div>
          ) : topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales in this range yet.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {topProducts.map((p) => (
                <li key={p.name} className="flex justify-between border-b border-border py-2">
                  <span>{p.name}</span>
                  <span className="tabular-nums">{p.qty}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="font-medium mb-2">Low stock warning</h2>
          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8" />
              ))}
            </div>
          ) : lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">Every product is above its low-stock threshold.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {lowStock.map((p) => (
                <li key={p.id} className="flex justify-between border-b border-border py-2">
                  <span>{p.name}</span>
                  <span className="text-red-600 dark:text-red-400 tabular-nums">
                    stock {p.stock} / threshold {p.low_stock_threshold}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  function StatCard({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
    return (
      <div
        className={`border rounded-xl p-3 ${
          emphasis
            ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950"
            : "border-border bg-surface"
        }`}
      >
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`font-semibold text-lg tabular-nums ${emphasis ? "text-emerald-800 dark:text-emerald-200" : ""}`}>
          {value}
        </p>
      </div>
    );
  }
  ```

  This replaces three separate `useState` calls (`sales`, `items`, `lowStock`) and a manual `useEffect` + `Promise.all` with one `useQuery` keyed on `[from, to]` — react-query refetches automatically when the date range changes (replacing the old dependency array) and caches previously-viewed ranges, so flipping back to a range you already viewed is now instant.

- [ ] **Step 2: Manually verify**

  Visit `/reports`, change the date range a few times (including back to a previous range, to confirm caching), toggle dark mode. Confirm stats, sparkline, top products, and low-stock warning all still populate correctly.

- [ ] **Step 3: Commit**

  ```bash
  git add app/reports/page.tsx
  git commit -m "refactor: migrate /reports to react-query"
  ```

---

### Task 8: Migrate `/sales` (list) to react-query

**Files:**
- Modify: `app/sales/page.tsx`

**Interfaces:**
- Consumes: `AppQueryProvider` from Task 6, `listSales` from `lib/sales.ts` (unchanged signature).

This page's "Show more" pagination is exactly what `useInfiniteQuery` is for — it replaces the manual `offset`/`rows` accumulation.

- [ ] **Step 1: Rewrite the page**

  Replace the full contents of `app/sales/page.tsx`:
  ```tsx
  "use client";

  import { useEffect, useState } from "react";
  import Link from "next/link";
  import { Receipt } from "lucide-react";
  import { useInfiniteQuery } from "@tanstack/react-query";
  import { createSupabaseBrowserClient } from "@/lib/supabase/client";
  import { listSales } from "@/lib/sales";
  import type { Sale } from "@/lib/schemas";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Skeleton } from "@/components/ui/skeleton";
  import { EmptyState } from "@/components/ui/empty-state";
  import { formatINR } from "@/lib/money";

  const PAGE_SIZE = 10;

  export default function SalesListPage() {
    const [date, setDate] = useState("");
    const [status, setStatus] = useState<"all" | "active" | "void">("all");
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    useEffect(() => {
      const t = setTimeout(() => setDebouncedSearch(search), 300);
      return () => clearTimeout(t);
    }, [search]);

    const {
      data,
      isLoading,
      isFetchingNextPage,
      hasNextPage,
      fetchNextPage,
      error,
    } = useInfiniteQuery({
      queryKey: ["sales", { date, status, debouncedSearch }],
      initialPageParam: 0,
      queryFn: async ({ pageParam }) => {
        const supabase = createSupabaseBrowserClient();
        const from = date ? new Date(`${date}T00:00:00`).toISOString() : undefined;
        const to = date ? new Date(`${date}T23:59:59.999`).toISOString() : undefined;
        return listSales(supabase, {
          from,
          to,
          status: status === "all" ? undefined : status,
          search: debouncedSearch || undefined,
          limit: PAGE_SIZE,
          offset: pageParam,
        });
      },
      getNextPageParam: (lastPage, allPages) => {
        const loaded = allPages.reduce((n, p) => n + p.rows.length, 0);
        return loaded < lastPage.count ? loaded : undefined;
      },
    });

    const rows = data?.pages.flatMap((p) => p.rows) ?? [];
    const count = data?.pages.at(-1)?.count ?? 0;
    const filtersActive = Boolean(date || debouncedSearch || status !== "all");

    return (
      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-semibold">Sales</h1>
          <Link href="/sales/new">
            <Button variant="brand">+ New sale</Button>
          </Link>
        </div>

        <div className="flex flex-col gap-2">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or phone"
          />
          <div className="flex gap-2 items-center">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-[9.5rem] shrink-0"
            />
            {date && (
              <Button variant="ghost" size="sm" onClick={() => setDate("")} aria-label="Clear date filter">
                Clear
              </Button>
            )}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="ml-auto h-11 border border-border rounded-lg px-3 text-sm bg-surface"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="void">Void</option>
            </select>
          </div>
        </div>

        {error && (
          <p className="text-red-600 dark:text-red-400 text-sm">
            {error instanceof Error ? error.message : "Load failed"}
          </p>
        )}

        {isLoading ? (
          <ul className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i}>
                <Skeleton className="h-16 w-full rounded-xl" />
              </li>
            ))}
          </ul>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={filtersActive ? "No bills match" : "No sales yet"}
            description={
              filtersActive ? "Try a different date, name, or phone number." : "Ready to ring up your first sale?"
            }
            action={
              <Link href="/sales/new">
                <Button variant="brand">+ New sale</Button>
              </Link>
            }
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {count} {count === 1 ? "bill" : "bills"}
            </p>
            <ul className="flex flex-col gap-2">
              {rows.map((s: Sale) => (
                <li key={s.id}>
                  <Link
                    href={`/sales/${s.id}`}
                    className="block border border-border rounded-xl p-3 hover:bg-surface-muted"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{s.bill_number}</span>
                      <span
                        className={
                          s.status === "void" ? "text-red-600 dark:text-red-400 text-xs" : "text-xs text-muted-foreground"
                        }
                      >
                        {s.status === "void"
                          ? "VOID"
                          : new Date(s.occurred_at).toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1 items-center gap-2">
                      <span className="text-muted-foreground truncate flex items-center gap-2">
                        {s.customer_name ?? "Walk-in"}
                        {s.channel === "offline" && (
                          <span className="text-xs px-1.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200">
                            Offline
                          </span>
                        )}
                      </span>
                      <span>{formatINR(s.total)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            {hasNextPage && (
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="self-center"
              >
                {isFetchingNextPage ? "Loading…" : `Show more (${count - rows.length} left)`}
              </Button>
            )}
          </>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 2: Manually verify**

  Visit `/sales`. Confirm: search debounces the same as before, date/status filters reset to page 1 correctly (react-query's `queryKey` change does this automatically — there's no more manual `setOffset(0)` effect), "Show more" appends rows and eventually disappears when everything is loaded, and the empty/error states render correctly.

- [ ] **Step 3: Commit**

  ```bash
  git add app/sales/page.tsx
  git commit -m "refactor: migrate /sales list to react-query useInfiniteQuery"
  ```

---

### Task 9: Migrate `/stock` to react-query

**Files:**
- Modify: `app/stock/page.tsx`

**Interfaces:**
- Consumes: `AppQueryProvider` from Task 6, `adjustStock` from `lib/sales.ts` (unchanged signature).

Unlike the previous three pages, `/stock` has both a query (the adjustments log) and a genuine mutation (saving a batch of adjustments) — this is `useMutation`'s intended use case, not just `useQuery`.

- [ ] **Step 1: Rewrite the page**

  Replace the full contents of `app/stock/page.tsx`:
  ```tsx
  "use client";

  import { useState } from "react";
  import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
  import { X } from "lucide-react";
  import { createSupabaseBrowserClient } from "@/lib/supabase/client";
  import { adjustStock } from "@/lib/sales";
  import type { Product, StockAdjustment } from "@/lib/schemas";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Skeleton } from "@/components/ui/skeleton";
  import { ProductPicker } from "@/components/product-picker";

  type Mode = "set" | "adjust";
  type Row = { product: Product; mode: Mode; value: string; reason: string };
  type LogEntry = StockAdjustment & { product_name: string };

  async function fetchLog(): Promise<LogEntry[]> {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("stock_adjustments")
      .select("*, products(name)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<StockAdjustment & { products: { name: string } | null }>).map((r) => ({
      ...r,
      product_name: r.products?.name ?? "(deleted)",
    }));
  }

  export default function StockPage() {
    const queryClient = useQueryClient();
    const { data: log = [], isLoading: loading } = useQuery({
      queryKey: ["stock-adjustments"],
      queryFn: fetchLog,
    });

    const [rows, setRows] = useState<Row[]>([]);
    const [ok, setOk] = useState<string | null>(null);

    const saveMutation = useMutation({
      mutationFn: async (entries: { product_id: string; mode: Mode; value: number; reason: string | null }[]) => {
        const supabase = createSupabaseBrowserClient();
        return adjustStock(supabase, entries);
      },
      onSuccess: (count) => {
        setOk(`${count} product${count === 1 ? "" : "s"} updated.`);
        setRows([]);
        queryClient.invalidateQueries({ queryKey: ["stock-adjustments"] });
      },
    });

    const addProduct = (p: Product) => {
      setRows((curr) =>
        curr.some((r) => r.product.id === p.id) ? curr : [...curr, { product: p, mode: "set", value: "", reason: "" }]
      );
    };

    const update = (id: string, patch: Partial<Row>) =>
      setRows((curr) => curr.map((r) => (r.product.id === id ? { ...r, ...patch } : r)));

    const remove = (id: string) => setRows((curr) => curr.filter((r) => r.product.id !== id));

    const selectedIds = rows.map((r) => r.product.id);
    const pending = rows.filter((r) => r.value !== "" && !isNaN(Number(r.value)));

    const save = () => {
      setOk(null);
      saveMutation.mutate(
        pending.map((r) => ({
          product_id: r.product.id,
          mode: r.mode,
          value: Number(r.value),
          reason: r.reason.trim() || null,
        }))
      );
    };

    const err = saveMutation.error instanceof Error ? saveMutation.error.message : null;

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-semibold">End-of-day stock</h1>
          <Button variant="brand" onClick={save} disabled={saveMutation.isPending || pending.length === 0}>
            {saveMutation.isPending ? "Saving..." : `Save ${pending.length || ""} changes`}
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Search and pick the products you want to update. Use <strong>Set to</strong> for a fresh count, or{" "}
          <strong>Adjust by</strong> a delta (<code>-3</code> for offline sales, <code>+10</code> for restock).
        </p>

        <section className="flex flex-col gap-2">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Add product to update</label>
          <ProductPicker onAdd={addProduct} excludeIds={selectedIds} includeOutOfStock placeholder="Search by name…" />
        </section>

        {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
        {ok && <p className="text-sm text-emerald-700 dark:text-emerald-400">{ok}</p>}

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border rounded-xl">
            No products selected yet. Use the search above to add them.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((r) => {
              const preview =
                r.value === "" || isNaN(Number(r.value))
                  ? null
                  : r.mode === "set"
                    ? Number(r.value)
                    : r.product.stock + Number(r.value);
              const invalid = preview !== null && preview < 0;
              return (
                <li key={r.product.id} className="border border-border rounded-xl p-3 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.product.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {r.product.stock}
                        {preview !== null && (
                          <>
                            {" → "}
                            <span
                              className={
                                invalid ? "text-red-600 dark:text-red-400 font-semibold" : "font-semibold text-foreground"
                              }
                            >
                              {preview}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(r.product.id)}
                      className="p-1 text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                      aria-label={`Remove ${r.product.name}`}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                    <div className="flex rounded-md overflow-hidden border border-border text-sm w-fit">
                      <button
                        type="button"
                        onClick={() => update(r.product.id, { mode: "set", value: "" })}
                        className={`px-3 py-1.5 ${
                          r.mode === "set" ? "bg-foreground text-background" : "bg-surface text-foreground"
                        }`}
                      >
                        Set to
                      </button>
                      <button
                        type="button"
                        onClick={() => update(r.product.id, { mode: "adjust", value: "" })}
                        className={`px-3 py-1.5 border-l border-border ${
                          r.mode === "adjust" ? "bg-foreground text-background" : "bg-surface text-foreground"
                        }`}
                      >
                        Adjust by
                      </button>
                    </div>
                    <Input
                      type={r.mode === "adjust" ? "text" : "number"}
                      inputMode="numeric"
                      pattern={r.mode === "adjust" ? "-?[0-9]*" : "[0-9]*"}
                      placeholder={r.mode === "set" ? "e.g. 15" : "e.g. -3"}
                      value={r.value}
                      onChange={(e) => update(r.product.id, { value: e.target.value })}
                      className="sm:w-28 tabular-nums"
                      aria-label={r.mode === "set" ? `Set stock for ${r.product.name}` : `Adjust stock for ${r.product.name}`}
                    />
                    <Input
                      placeholder="Reason (optional)"
                      value={r.reason}
                      onChange={(e) => update(r.product.id, { reason: e.target.value })}
                      className="flex-1 min-w-0"
                      aria-label={`Reason for ${r.product.name}`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <section className="mt-4">
          <h2 className="font-medium mb-2">Recent adjustments</h2>
          {loading ? (
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-6" />
              ))}
            </div>
          ) : log.length === 0 ? (
            <p className="text-sm text-muted-foreground">No adjustments recorded yet. Saved changes will show up here.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {log.map((e) => (
                <li key={e.id} className="border-b border-border py-1.5 flex items-center gap-2 flex-wrap">
                  <span className="text-muted-foreground text-xs w-32 shrink-0">
                    {new Date(e.created_at).toLocaleString("en-IN")}
                  </span>
                  <span className="flex-1 truncate">{e.product_name}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {e.old_stock} → {e.new_stock}
                  </span>
                  <span
                    className={`px-1.5 rounded tabular-nums ${
                      e.delta >= 0
                        ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                        : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                    } text-xs`}
                  >
                    {e.delta >= 0 ? "+" : ""}
                    {e.delta}
                  </span>
                  {e.reason && <span className="text-xs text-muted-foreground">· {e.reason}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }
  ```

- [ ] **Step 2: Manually verify**

  Visit `/stock`. Add a couple of products via the picker, set/adjust values, save, confirm the success message appears, the row list clears, and the "Recent adjustments" log refreshes to show the new entries (via `invalidateQueries`, replacing the old manual `await loadLog()` call).

- [ ] **Step 3: Commit**

  ```bash
  git add app/stock/page.tsx
  git commit -m "refactor: migrate /stock to react-query (query + mutation)"
  ```

---

### Task 10: Refresh the README

**Files:**
- Modify: `README.md`

The README still frames the app as "v1 inventory-only, Phase 2 later" and its file map only lists the original inventory-CRUD files — everything built since (sales, billing, PDF, stock, reports, the storefront, and everything from Plans 1 and 2) is undocumented.

- [ ] **Step 1: Replace the intro and scope section**

  Change:
  ```markdown
  # Return-Gift Shop — Inventory v1

  Mobile-friendly inventory manager for a small return-gift shop. Built to run **100% free** on Vercel + Supabase.

  **v1 scope:** inventory CRUD with auto-calculated margins and image uploads.
  Phase 2 (later): POS billing, GST PDF invoice, WhatsApp share, dashboard.
  ```
  to:
  ```markdown
  # Bishal Cuurio Boutique

  Mobile-first shop management app for a small return-gift and decor-rental boutique. Built to run **100% free** on Vercel + Supabase.

  **Two audiences, one app:** a public catalog (`/`, `/product/[id]`) customers browse and select items from to enquire via WhatsApp — no accounts, no online checkout (planned for a future phase) — and a signed-in admin suite for inventory, POS billing with PDF invoices, end-of-day stock adjustment, and sales/profit reporting.
  ```

- [ ] **Step 2: Replace the File map section**

  Change the entire `## File map` section's contents to:
  ```text
  app/
    layout.tsx                 shell: theme script, query provider, selection provider
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

  (If the Customer Selection plan has already been executed by the time this task runs, also add `components/selection-provider.tsx`, `components/selection-bar.tsx`, `components/select-toggle.tsx`, and `lib/selection.ts` to this list — check whether those files exist before finalizing this step.)

- [ ] **Step 2: Commit**

  ```bash
  git add README.md
  git commit -m "docs: refresh README scope and file map to match current app"
  ```
