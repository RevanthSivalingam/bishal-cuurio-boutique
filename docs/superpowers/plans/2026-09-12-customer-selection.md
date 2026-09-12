# Customer Selection → WhatsApp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let customers select multiple catalog items (across categories and product pages) and send one combined WhatsApp message to the shop, without building a cart/checkout/orders system.

**Architecture:** Entirely client-side. A pure, unit-tested `lib/selection.ts` module handles the data shape, localStorage persistence, and WhatsApp message formatting. A `SelectionProvider` React context (lifted to the root layout) holds the live selection state so a toggle on any product card and the floating summary bar stay in sync on the same page without a refresh. No new Supabase table, RPC, or route.

**Tech Stack:** Next.js 16 (App Router), React context, `localStorage`, the existing `wa.me` deep-link pattern (already used by `components/enquire-button.tsx`), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-12-ux-restructure-design.md` (§ A. Customer selection → WhatsApp)

## Global Constraints

- No new Supabase tables, RPCs, or routes — this feature never talks to the backend.
- **Depends on the Admin Cleanup plan's Task 6** (`components/query-provider.tsx` + `AppQueryProvider` mounted in `app/layout.tsx`) already being done — this plan adds a second provider alongside it in the same file. If that plan hasn't run yet, `AppQueryProvider` won't exist; wrap with just `SelectionProvider` in that case and note the gap.
- Selection persists across browser sessions (`localStorage`), does not auto-clear after sharing, and has no quantity — items are either selected or not (all per the approved spec).
- The existing single-item `EnquireButton` is **not replaced** — it stays for "ask about just this one now." Selection is the separate "build a list, send together" flow.
- Share goes straight to the shop's WhatsApp number via the same `NEXT_PUBLIC_SHOP_WHATSAPP` env var and `wa.me` URL pattern `EnquireButton` already uses — not the native share sheet.
- The selection bar only renders on storefront routes (`/` and `/product/*`) — never on admin pages.

---

### Task 1: Pure selection logic + message formatting (`lib/selection.ts`)

**Files:**
- Create: `lib/selection.ts`
- Create: `lib/selection.test.ts`

**Interfaces:**
- Produces: `type SelectedItem = { id: string; name: string; price: number }`; `addItem(items, item): SelectedItem[]`; `removeItem(items, id): SelectedItem[]`; `readSelection(): SelectedItem[]`; `writeSelection(items): void`; `buildWhatsAppMessage(items, origin): string`. Task 2's `SelectionProvider` consumes all of these.

- [ ] **Step 1: Write the failing tests**

  Create `lib/selection.test.ts`:
  ```ts
  import { describe, it, expect, beforeEach } from "vitest";
  import {
    addItem,
    removeItem,
    buildWhatsAppMessage,
    readSelection,
    writeSelection,
    type SelectedItem,
  } from "./selection";

  const vase: SelectedItem = { id: "1", name: "Brass Vase", price: 450 };
  const lamp: SelectedItem = { id: "2", name: "Ceramic Lamp", price: 1200 };

  describe("addItem", () => {
    it("adds a new item", () => {
      expect(addItem([], vase)).toEqual([vase]);
    });
    it("ignores a duplicate id", () => {
      expect(addItem([vase], { ...vase, name: "Different name" })).toEqual([vase]);
    });
  });

  describe("removeItem", () => {
    it("removes the matching item", () => {
      expect(removeItem([vase, lamp], "1")).toEqual([lamp]);
    });
    it("is a no-op when the id isn't present", () => {
      expect(removeItem([vase], "999")).toEqual([vase]);
    });
  });

  describe("buildWhatsAppMessage", () => {
    it("formats a single item", () => {
      const msg = buildWhatsAppMessage([vase], "https://shop.example");
      expect(msg).toBe(
        "Hi! I'm interested in these:\n\n1. Brass Vase — ₹450\nhttps://shop.example/product/1\n\n1 item total"
      );
    });
    it("numbers and joins multiple items", () => {
      const msg = buildWhatsAppMessage([vase, lamp], "https://shop.example");
      expect(msg).toContain("1. Brass Vase — ₹450");
      expect(msg).toContain("2. Ceramic Lamp — ₹1,200");
      expect(msg).toContain("2 items total");
    });
    it("preserves special characters verbatim — URL-encoding happens at the caller, not here", () => {
      const special: SelectedItem = { id: "3", name: 'Vase "Deluxe" & Co.', price: 100 };
      const msg = buildWhatsAppMessage([special], "https://shop.example");
      expect(msg).toContain('Vase "Deluxe" & Co.');
    });
  });

  describe("readSelection / writeSelection", () => {
    beforeEach(() => {
      window.localStorage.clear();
    });

    it("round-trips items through localStorage", () => {
      writeSelection([vase, lamp]);
      expect(readSelection()).toEqual([vase, lamp]);
    });
    it("returns an empty array when nothing is stored", () => {
      expect(readSelection()).toEqual([]);
    });
    it("returns an empty array for corrupted JSON instead of throwing", () => {
      window.localStorage.setItem("cuurio:selection", "{not valid json");
      expect(readSelection()).toEqual([]);
    });
  });
  ```

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `npx vitest run lib/selection.test.ts`
  Expected: FAIL — `./selection` doesn't exist yet.

- [ ] **Step 3: Implement**

  Create `lib/selection.ts`:
  ```ts
  import { formatINR } from "./money";

  const STORAGE_KEY = "cuurio:selection";

  export type SelectedItem = {
    id: string;
    name: string;
    price: number;
  };

  export function readSelection(): SelectedItem[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  export function writeSelection(items: SelectedItem[]): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // localStorage unavailable (private browsing, quota) — selection just won't persist.
    }
  }

  export function addItem(items: SelectedItem[], item: SelectedItem): SelectedItem[] {
    if (items.some((i) => i.id === item.id)) return items;
    return [...items, item];
  }

  export function removeItem(items: SelectedItem[], id: string): SelectedItem[] {
    return items.filter((i) => i.id !== id);
  }

  export function buildWhatsAppMessage(items: SelectedItem[], origin: string): string {
    const lines = items.map(
      (item, i) => `${i + 1}. ${item.name} — ${formatINR(item.price)}\n${origin}/product/${item.id}`
    );
    return `Hi! I'm interested in these:\n\n${lines.join("\n\n")}\n\n${items.length} item${
      items.length === 1 ? "" : "s"
    } total`;
  }
  ```

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `npx vitest run lib/selection.test.ts`
  Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

  ```bash
  git add lib/selection.ts lib/selection.test.ts
  git commit -m "feat: add pure selection state + WhatsApp message formatting logic"
  ```

---

### Task 2: `SelectionProvider` context, wired into the root layout

**Files:**
- Create: `components/selection-provider.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: everything from `lib/selection.ts` (Task 1).
- Produces: `SelectionProvider({ children })` and `useSelection(): { items, add, remove, clear, has }`. Tasks 3 and 4 both consume `useSelection`.

A single shared state (via context) is required here, not one `useState` per component — a toggle on a product card and the floating bar are separate component instances, and without a shared source of truth, toggling a card wouldn't update the bar's count until a full page reload.

- [ ] **Step 1: Create the provider**

  ```tsx
  "use client";

  import { createContext, useCallback, useContext, useEffect, useState } from "react";
  import {
    addItem,
    readSelection,
    removeItem,
    writeSelection,
    type SelectedItem,
  } from "@/lib/selection";

  type SelectionContextValue = {
    items: SelectedItem[];
    add: (item: SelectedItem) => void;
    remove: (id: string) => void;
    clear: () => void;
    has: (id: string) => boolean;
  };

  const SelectionContext = createContext<SelectionContextValue | null>(null);

  export function SelectionProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<SelectedItem[]>([]);

    useEffect(() => {
      setItems(readSelection());
    }, []);

    const add = useCallback((item: SelectedItem) => {
      setItems((curr) => {
        const next = addItem(curr, item);
        writeSelection(next);
        return next;
      });
    }, []);

    const remove = useCallback((id: string) => {
      setItems((curr) => {
        const next = removeItem(curr, id);
        writeSelection(next);
        return next;
      });
    }, []);

    const clear = useCallback(() => {
      writeSelection([]);
      setItems([]);
    }, []);

    const has = useCallback((id: string) => items.some((i) => i.id === id), [items]);

    return (
      <SelectionContext.Provider value={{ items, add, remove, clear, has }}>
        {children}
      </SelectionContext.Provider>
    );
  }

  export function useSelection() {
    const ctx = useContext(SelectionContext);
    if (!ctx) throw new Error("useSelection must be used within a SelectionProvider");
    return ctx;
  }
  ```

- [ ] **Step 2: Mount it in the root layout**

  In `app/layout.tsx`, add the import:
  ```tsx
  import { SelectionProvider } from "@/components/selection-provider";
  ```
  If the Admin Cleanup plan's `AppQueryProvider` is already present, change:
  ```tsx
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <AppQueryProvider>{children}</AppQueryProvider>
      </body>
  ```
  to:
  ```tsx
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <AppQueryProvider>
          <SelectionProvider>{children}</SelectionProvider>
        </AppQueryProvider>
      </body>
  ```
  (If `AppQueryProvider` isn't present yet, wrap `{children}` with just `<SelectionProvider>` instead.)

- [ ] **Step 3: Manually verify**

  Run `npm run dev`. This provider has no visible UI yet (Tasks 3–4 add the consumers), so there's nothing to see — verify only that the app still builds and every route still loads with no console errors (confirms the context is correctly mounted and `useSelection()` won't throw once something calls it).

- [ ] **Step 4: Commit**

  ```bash
  git add components/selection-provider.tsx app/layout.tsx
  git commit -m "feat: add SelectionProvider context, mount at root layout"
  ```

---

### Task 3: `SelectToggle` control, wired into the catalog card and product detail page

**Files:**
- Create: `components/select-toggle.tsx`
- Modify: `components/catalog-card.tsx`, `app/product/[id]/page.tsx`

**Interfaces:**
- Consumes: `useSelection()` from Task 2.

- [ ] **Step 1: Create the toggle**

  ```tsx
  "use client";

  import { Check, Plus } from "lucide-react";
  import { useSelection } from "@/components/selection-provider";
  import type { SelectedItem } from "@/lib/selection";

  type Props = {
    item: SelectedItem;
    size?: "sm" | "lg";
  };

  export function SelectToggle({ item, size = "sm" }: Props) {
    const { has, add, remove } = useSelection();
    const selected = has(item.id);

    const sizeClass = size === "lg" ? "h-12 px-4 text-sm rounded-lg" : "size-8 rounded-full p-0";
    const toneClass = selected
      ? "bg-brass-deep border-brass-deep text-white dark:text-[#14130f]"
      : "bg-paper/90 backdrop-blur border-paper-edge text-ink hover:border-brass";

    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (selected) remove(item.id);
          else add(item);
        }}
        aria-label={selected ? `Remove ${item.name} from selection` : `Add ${item.name} to selection`}
        aria-pressed={selected}
        className={`inline-flex items-center justify-center gap-2 border font-medium transition-colors ${sizeClass} ${toneClass}`}
      >
        {selected ? <Check className="size-4" /> : <Plus className="size-4" />}
        {size === "lg" && (selected ? "Selected" : "Select")}
      </button>
    );
  }
  ```

  `e.preventDefault()` / `e.stopPropagation()` are required because `CatalogCard`'s entire tile is a `<Link>` — without stopping propagation, tapping the toggle would also navigate to the product page.

- [ ] **Step 2: Add it to `CatalogCard`**

  In `components/catalog-card.tsx`, add the import:
  ```tsx
  import { SelectToggle } from "@/components/select-toggle";
  ```
  Change:
  ```tsx
          <div className="relative aspect-square bg-paper-panel p-2">
            {product.image_url ? (
              <Image
                src={product.image_url}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 50vw, 33vw"
                className="object-contain"
              />
            ) : (
              <InitialsAvatar name={product.name} />
            )}
            {urgent && (
              <span className="absolute top-2 left-2 specimen-label text-brass bg-paper/90 backdrop-blur px-2 py-1 rounded">
                {av.label}
              </span>
            )}
          </div>
  ```
  to:
  ```tsx
          <div className="relative aspect-square bg-paper-panel p-2">
            {product.image_url ? (
              <Image
                src={product.image_url}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 50vw, 33vw"
                className="object-contain"
              />
            ) : (
              <InitialsAvatar name={product.name} />
            )}
            {urgent && (
              <span className="absolute top-2 left-2 specimen-label text-brass bg-paper/90 backdrop-blur px-2 py-1 rounded">
                {av.label}
              </span>
            )}
            <div className="absolute top-2 right-2">
              <SelectToggle item={{ id: product.id, name: product.name, price: product.selling_price }} />
            </div>
          </div>
  ```

- [ ] **Step 3: Add it to the product detail page**

  In `app/product/[id]/page.tsx`, add the import:
  ```tsx
  import { SelectToggle } from "@/components/select-toggle";
  ```
  Change:
  ```tsx
              <div className="flex flex-col gap-3 pt-1">
                <EnquireButton name={p.name} price={priceLabel} available={inStock} />
                <ShareButtons
                  title={p.name}
                  text={`${p.name} · ${priceLabel}`}
                />
              </div>
  ```
  to:
  ```tsx
              <div className="flex flex-col gap-3 pt-1">
                <div className="flex items-center gap-3">
                  <EnquireButton name={p.name} price={priceLabel} available={inStock} />
                  <SelectToggle
                    item={{ id: p.id, name: p.name, price: p.selling_price }}
                    size="lg"
                  />
                </div>
                <ShareButtons
                  title={p.name}
                  text={`${p.name} · ${priceLabel}`}
                />
              </div>
  ```

- [ ] **Step 4: Manually verify**

  Run `npm run dev`, visit `/`. Tap the select toggle on a couple of product cards — confirm it flips between "+" and a checkmark, and does **not** navigate to the product page. Visit a product detail page directly and confirm the larger toggle there also works and reflects the same selection state (toggling on the catalog card should show as already-selected when you open that product's detail page, since both read from the same context). No automated test — this is markup/interaction wiring over already-tested pure logic (Task 1) and an already-verified provider (Task 2).

- [ ] **Step 5: Commit**

  ```bash
  git add components/select-toggle.tsx components/catalog-card.tsx app/product/\[id\]/page.tsx
  git commit -m "feat: add select toggle to catalog card and product detail page"
  ```

---

### Task 4: `SelectionBar` — the floating summary bar and WhatsApp share

**Files:**
- Create: `components/selection-bar.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `useSelection()` from Task 2, `buildWhatsAppMessage` from Task 1.

- [ ] **Step 1: Create the bar**

  ```tsx
  "use client";

  import { usePathname } from "next/navigation";
  import { useState } from "react";
  import { MessageCircle, X } from "lucide-react";
  import { useSelection } from "@/components/selection-provider";
  import { buildWhatsAppMessage } from "@/lib/selection";

  const SHOP_WA = (process.env.NEXT_PUBLIC_SHOP_WHATSAPP ?? "").replace(/\D/g, "");

  export function SelectionBar() {
    const pathname = usePathname();
    const { items, remove, clear } = useSelection();
    const [open, setOpen] = useState(false);

    const isStorefront = pathname === "/" || pathname.startsWith("/product/");
    if (!isStorefront || items.length === 0) return null;

    const share = () => {
      const message = buildWhatsAppMessage(items, window.location.origin);
      const base = SHOP_WA ? `https://wa.me/${SHOP_WA}` : "https://wa.me/";
      window.open(`${base}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    };

    return (
      <div className="fixed bottom-0 inset-x-0 z-40 bg-ink text-paper px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
        {open && (
          <ul className="flex flex-col gap-1.5 mb-3 max-h-40 overflow-y-auto">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{item.name}</span>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  aria-label={`Remove ${item.name}`}
                  className="p-1 opacity-70 hover:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-sm font-medium underline underline-offset-2"
          >
            {items.length} selected
          </button>
          <button type="button" onClick={clear} className="text-sm opacity-70 hover:opacity-100">
            Clear all
          </button>
          <button
            type="button"
            onClick={share}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-brass-deep px-4 h-11 text-sm font-medium dark:text-[#14130f]"
          >
            <MessageCircle className="size-4" />
            Share via WhatsApp
          </button>
        </div>
      </div>
    );
  }
  ```

  `SHOP_WA` and the `wa.me` URL construction deliberately mirror `components/enquire-button.tsx` exactly — same env var, same fallback-to-bare-`wa.me` behavior when it's unset, so there's exactly one place a shop owner needs to configure their WhatsApp number.

- [ ] **Step 2: Mount it in the root layout**

  In `app/layout.tsx`, add the import:
  ```tsx
  import { SelectionBar } from "@/components/selection-bar";
  ```
  Change:
  ```tsx
        <AppQueryProvider>
          <SelectionProvider>{children}</SelectionProvider>
        </AppQueryProvider>
  ```
  to:
  ```tsx
        <AppQueryProvider>
          <SelectionProvider>
            {children}
            <SelectionBar />
          </SelectionProvider>
        </AppQueryProvider>
  ```

- [ ] **Step 3: Manually verify end-to-end, including on a real phone**

  Run `npm run dev -- -H 0.0.0.0` (the project's existing same-WiFi mobile-testing workflow, documented in the README) and open the site on a phone.

  - Select 2–3 items across different categories on `/`. Confirm the bar appears at the bottom, shows the correct count, and stays out of the way of the page content (if it visually overlaps the last row of products or an on-page button, add bottom padding to the affected page).
  - Tap the count to expand the list, remove one item from the expanded list, confirm the count updates.
  - Tap "Share via WhatsApp" — confirm it opens WhatsApp (or `wa.me` in a new tab on desktop) with a pre-filled message listing the remaining selected items, each with name, price, and a working link back to its product page.
  - Close the tab, reopen the site — confirm the selection is still there (localStorage persistence) and the bar reappears.
  - Confirm the bar does **not** appear on any admin page (`/inventory`, `/sales`, etc.) even while items are selected.
  - Check both light and dark mode.

  No further automated tests apply here — the pure logic is already covered by Task 1, and this step is exercising the actual integrated UX end-to-end the way a real customer would, which is what the spec's own testing section calls for.

- [ ] **Step 4: Commit**

  ```bash
  git add components/selection-bar.tsx app/layout.tsx
  git commit -m "feat: add floating selection bar with WhatsApp share"
  ```
