# Brand Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the shop's real logo and brand colors (maroon/gold, extracted from the artwork) into the header, favicon, login page, and generated PDF bills — replacing the placeholder identity that existed before the logo was designed.

**Architecture:** Pure frontend/asset work. No backend, database, or route changes. The logo assets are already prepared in `public/branding/` (transparent PNG cutouts at several sizes, generated with ImageMagick from the source artwork). This plan wires those existing files into the app via CSS custom-property edits, Next.js's file-based icon convention, and two small JSX/`next/image` additions, plus one PDF-generation tweak.

**Tech Stack:** Next.js 16 (App Router), Tailwind v4 CSS custom properties, `next/image`, `jsPDF` (already in use for bills), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-12-ux-restructure-design.md` (§ C. Brand integration)

## Global Constraints

- No new Supabase tables, RPCs, or routes — this plan is frontend/asset-only.
- Admin's functional zinc palette and its emerald "brand" CTA button color (`components/ui/button.tsx`, `variant="brand"`, used only on `/sales*` and `/stock`) are **not touched** — confirmed via grep that admin's emerald buttons are hardcoded Tailwind classes, fully independent of the `--brass`/`--brass-deep` tokens this plan changes. Only the customer-facing storefront skin and the shared header/login chrome change.
- Next.js 16 icon file conventions were confirmed unchanged from the familiar App Router pattern (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md`): `app/favicon.ico`, `app/icon.png`, `app/apple-icon.png` are auto-detected, no metadata code needed.
- All new visual elements must render correctly in both light and dark mode (toggle via the existing `ThemeToggle`).
- Source assets already on disk, do not regenerate: `public/branding/logo-full.png` (700px wide, transparent, header/login use), `public/branding/logo-full-highres.png` (866×1009, transparent, print-quality master), `public/branding/logo-mark.png` (520×520, emblem only, transparent), `public/branding/favicon-16.png`, `public/branding/favicon-32.png`, `public/branding/apple-touch-icon.png`.
- Brand colors extracted from the artwork: maroon `#611E20`, brass gold `#C9A24C`.

---

### Task 1: Retune storefront accent tokens to the logo's brand colors

**Files:**
- Modify: `app/globals.css:9-30` (`:root` block), `app/globals.css:32-53` (`.dark, :root.dark` block), `app/globals.css:55-77` (`@media (prefers-color-scheme: dark)` block)

**Interfaces:**
- Produces: `--brass` and `--brass-deep` CSS custom properties now resolve to the real brand colors everywhere they're already consumed (`bg-brass-deep`, `text-brass`, `border-brass`, etc. in `app/page.tsx`, `app/product/[id]/page.tsx`, `components/catalog-card.tsx`, `components/catalog-grid.tsx`, `components/enquire-button.tsx`) — no consuming file needs to change.

The current `--brass`/`--brass-deep` values are a generic amber placeholder chosen before the logo existed. The logo's own maroon (`#611E20`, from "BISHAL") and gold (`#C9A24C`, from the ring/"CUURIO BOUTIQUE") replace them. Dark mode needs a *lighter* maroon than the raw hex, because `components/enquire-button.tsx` pairs `bg-brass-deep` with near-black text (`dark:text-[#14130f]`) in dark mode — a dark-on-dark button would be illegible. `#D16164` is that same maroon hue lightened to roughly the same lightness the current dark-mode brass already uses (so contrast with the existing near-black text stays the same as it is today).

- [ ] **Step 1: Update the light-mode block**

  In `app/globals.css`, inside `:root { ... }`, change:
  ```css
  --brass: #a6783f;
  --brass-deep: #7a5a2e;
  ```
  to:
  ```css
  --brass: #C9A24C;
  --brass-deep: #611E20;
  ```

- [ ] **Step 2: Update the `.dark` block**

  Inside `.dark, :root.dark { ... }`, change:
  ```css
  --brass: #c79a5a;
  --brass-deep: #c79a5a;
  ```
  to:
  ```css
  --brass: #C9A24C;
  --brass-deep: #D16164;
  ```

- [ ] **Step 3: Update the `@media (prefers-color-scheme: dark)` block**

  This block duplicates the dark values on purpose (see the comment at the top of the file explaining why Tailwind's `dark:` variant is pinned to the `.dark` class) — it must be kept in sync with Step 2. Inside `:root:not(.light) { ... }` under the media query, make the same change:
  ```css
  --brass: #c79a5a;
  --brass-deep: #c79a5a;
  ```
  to:
  ```css
  --brass: #C9A24C;
  --brass-deep: #D16164;
  ```

- [ ] **Step 4: Manually verify in the browser**

  Run `npm run dev`, open `/` and a `/product/[id]` page.
  - Light mode: "Enquire on WhatsApp" button should be deep maroon with white text.
  - Toggle dark mode (via the theme toggle in the nav): the button should be a lighter dusty-rose maroon, still with clearly legible dark text.
  - Check the specimen-label/category-chip borders and any `text-brass` accents also shifted from amber to gold.

  This is a CSS custom-property value change with no branching logic, so there's no meaningful unit test to write here — the dark-mode contrast reasoning above is the "test," and this manual pass confirms it renders as expected.

- [ ] **Step 5: Commit**

  ```bash
  git add app/globals.css
  git commit -m "style: retune storefront accent to real brand colors (maroon/gold)"
  ```

---

### Task 2: Wire the logo as favicon, app icon, and apple touch icon

**Files:**
- Create: `app/icon.png`
- Create: `app/apple-icon.png`
- Modify: `app/favicon.ico` (binary replace)

**Interfaces:**
- Consumes: `public/branding/logo-mark.png`, `public/branding/favicon-16.png`, `public/branding/favicon-32.png` (already on disk).
- Produces: nothing other code depends on — Next.js's file-based convention detects these automatically and injects the right `<link>` tags; no metadata code changes needed (confirmed against the Next 16 docs, see Global Constraints).

- [ ] **Step 1: Generate the three icon files from the prepared mark**

  ```bash
  magick public/branding/logo-mark.png -resize 512x512 -background none -gravity center -extent 512x512 app/icon.png
  magick public/branding/logo-mark.png -resize 180x180 -background none -gravity center -extent 180x180 app/apple-icon.png
  magick public/branding/favicon-16.png public/branding/favicon-32.png app/favicon.ico
  identify app/icon.png app/apple-icon.png app/favicon.ico
  ```
  Expected `identify` output: `app/icon.png` 512x512, `app/apple-icon.png` 180x180, `app/favicon.ico` reporting two frames (16x16 and 32x32).

- [ ] **Step 2: Verify Next.js picked them up**

  Run `npm run dev`, open `http://localhost:3000/icon` and `http://localhost:3000/apple-icon` directly in the browser — both should render the logo mark (Next serves the file-convention icons at these paths). Then load `/` and confirm the browser tab favicon shows the mark (hard-refresh or open in a fresh incognito window, since favicons are aggressively cached).

- [ ] **Step 3: Commit**

  ```bash
  git add app/icon.png app/apple-icon.png app/favicon.ico
  git commit -m "feat: replace placeholder favicon/icons with shop logo mark"
  ```

---

### Task 3: Show the logo in the shared site header

**Files:**
- Modify: `components/top-nav.tsx`

**Interfaces:**
- Consumes: `public/branding/logo-mark.png` (already on disk). `Package` icon import stays — it's still used for the "Inventory" nav item in `AUTHED_NAV`, don't remove it.

The header (`TopNav`) is shared chrome rendered on every page, storefront and admin alike — it currently shows a generic `Package` icon next to the shop name in both the top bar and the mobile drawer header. Replace that icon with the real logo mark in both places. This doesn't violate "keep the two skins separate" (spec non-goals) — it's the shop's identity mark shown once in shared navigation, not a re-theme of admin's screens.

- [ ] **Step 1: Add the `next/image` import**

  In `components/top-nav.tsx`, add to the top imports:
  ```tsx
  import Image from "next/image";
  ```

- [ ] **Step 2: Replace the icon in the top bar link**

  Change:
  ```tsx
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold min-w-0"
          >
            <Package className="size-5 shrink-0" />
            <span className="truncate">
              {process.env.NEXT_PUBLIC_SHOP_NAME || "Boutique"}
            </span>
          </Link>
  ```
  to:
  ```tsx
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold min-w-0"
          >
            <Image
              src="/branding/logo-mark.png"
              alt=""
              width={28}
              height={28}
              className="size-7 shrink-0 object-contain"
            />
            <span className="truncate">
              {process.env.NEXT_PUBLIC_SHOP_NAME || "Boutique"}
            </span>
          </Link>
  ```
  (`alt=""` because the adjacent shop-name text already names the link for screen readers — the logo here is decorative, not the only label.)

- [ ] **Step 3: Replace the icon in the drawer header**

  Change:
  ```tsx
          <span className="font-semibold truncate">
            {process.env.NEXT_PUBLIC_SHOP_NAME || "Boutique"}
          </span>
  ```
  to:
  ```tsx
          <span className="flex items-center gap-2 font-semibold truncate">
            <Image
              src="/branding/logo-mark.png"
              alt=""
              width={24}
              height={24}
              className="size-6 shrink-0 object-contain"
            />
            {process.env.NEXT_PUBLIC_SHOP_NAME || "Boutique"}
          </span>
  ```

- [ ] **Step 4: Manually verify**

  Run `npm run dev`. Confirm the logo mark renders crisply (not blurry) at this small size in the top bar, on both `/` (logged out) and an admin page while logged in. Open the mobile drawer (hamburger button) and confirm the mark also renders there. Check both light and dark mode.

  This is a markup-only change (swapping one icon element for another) with no new logic, so verification is the manual render check above rather than a unit test — consistent with this file having no existing component-level tests to extend.

- [ ] **Step 5: Commit**

  ```bash
  git add components/top-nav.tsx
  git commit -m "feat: show shop logo mark in header and mobile drawer"
  ```

---

### Task 4: Show the logo on the login page

**Files:**
- Modify: `app/login/page.tsx`

**Interfaces:**
- Consumes: `public/branding/logo-full.png` (already on disk, 700×816, transparent).

- [ ] **Step 1: Add the `next/image` import**

  In `app/login/page.tsx`, add to the top imports:
  ```tsx
  import Image from "next/image";
  ```

- [ ] **Step 2: Replace the text heading with the logo**

  Change:
  ```tsx
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            {process.env.NEXT_PUBLIC_SHOP_NAME || "Boutique"}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Sign in to manage your shop.
          </p>
        </div>
  ```
  to:
  ```tsx
        <div className="mb-6 flex flex-col items-center text-center">
          <h1 className="sr-only">
            {process.env.NEXT_PUBLIC_SHOP_NAME || "Boutique"}
          </h1>
          <Image
            src="/branding/logo-full.png"
            alt=""
            width={220}
            height={256}
            className="h-32 w-auto object-contain mb-3"
            priority
          />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Sign in to manage your shop.
          </p>
        </div>
  ```
  The `<h1>` stays for page-heading semantics/accessibility (a login page should have one heading), just visually hidden (`sr-only`) since the logo image now carries that role visually — hence `alt=""` on the image, to avoid the shop name being announced twice by a screen reader.

- [ ] **Step 3: Manually verify**

  Run `npm run dev`, visit `/login` while signed out. Confirm the logo renders above the form, centered, in both light and dark mode, and looks proportionate at a mobile viewport width (~375px) — the login card is already `max-w-sm`, so check the logo doesn't overflow it.

- [ ] **Step 4: Commit**

  ```bash
  git add app/login/page.tsx
  git commit -m "feat: show shop logo on login page"
  ```

---

### Task 5: Embed the logo on generated PDF bills

**Files:**
- Create: `public/branding/logo-pdf.png` (small, PDF-optimized derivative)
- Modify: `components/bill-pdf.ts`
- Create: `components/bill-pdf.test.ts`

**Interfaces:**
- Produces: `bufferToBase64(buf: ArrayBuffer): string` and `loadLogoBase64(): Promise<string>`, both exported from `components/bill-pdf.ts` for the test below. `generateBillPdf`'s existing signature (`(sale, items, opts) => Promise<void>`) is unchanged — callers in `app/sales/[id]/page.tsx` etc. need no changes.

The existing font-loading code (`loadFontBase64`) fetches `/fonts/NotoSans-Regular.ttf` and base64-encodes it via a manual byte-chunking loop. Reuse that exact pattern for the logo instead of duplicating the encoding loop — extract it into a shared `bufferToBase64` helper.

- [ ] **Step 1: Generate the PDF-sized logo asset**

  The existing `logo-full-highres.png` (866×1009) is far larger than a PDF needs — jsPDF places it at ~20mm wide, so a few hundred px is plenty and keeps the base64 payload small.

  ```bash
  magick public/branding/logo-full-highres.png -resize 300x public/branding/logo-pdf.png
  identify public/branding/logo-pdf.png
  ```
  Expected: `300x350` (aspect ratio preserved from the 866×1009 source).

- [ ] **Step 2: Write the failing tests**

  Create `components/bill-pdf.test.ts`:
  ```ts
  import { describe, it, expect, vi, beforeEach } from "vitest";

  describe("bill-pdf logo loading", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
      vi.resetModules();
    });

    it("fetches and base64-encodes the logo, then caches it", async () => {
      const bytes = new Uint8Array([1, 2, 3, 4]);
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => bytes.buffer,
      });
      vi.stubGlobal("fetch", fetchMock);

      const { loadLogoBase64, bufferToBase64 } = await import("./bill-pdf");
      const expected = bufferToBase64(bytes.buffer);

      const first = await loadLogoBase64();
      const second = await loadLogoBase64();

      expect(first).toBe(expected);
      expect(second).toBe(expected);
      expect(fetchMock).toHaveBeenCalledTimes(1); // second call hit the cache
    });

    it("throws a clear error when the logo fetch fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 404 })
      );

      const { loadLogoBase64 } = await import("./bill-pdf");

      await expect(loadLogoBase64()).rejects.toThrow(
        "Failed to load PDF logo: 404"
      );
    });
  });
  ```

- [ ] **Step 3: Run the tests to verify they fail**

  Run: `npx vitest run components/bill-pdf.test.ts`
  Expected: FAIL — `loadLogoBase64` and `bufferToBase64` are not exported yet.

- [ ] **Step 4: Implement — extract the shared helper and add the logo loader**

  In `components/bill-pdf.ts`, change:
  ```ts
  const FONT_URL = "/fonts/NotoSans-Regular.ttf";
  const FONT_NAME = "NotoSans";
  let cachedFontBase64: string | null = null;

  async function loadFontBase64(): Promise<string> {
    if (cachedFontBase64) return cachedFontBase64;
    const res = await fetch(FONT_URL);
    if (!res.ok) throw new Error(`Failed to load PDF font: ${res.status}`);
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    cachedFontBase64 = btoa(binary);
    return cachedFontBase64;
  }
  ```
  to:
  ```ts
  const FONT_URL = "/fonts/NotoSans-Regular.ttf";
  const FONT_NAME = "NotoSans";
  const LOGO_URL = "/branding/logo-pdf.png";
  const LOGO_ASPECT = 300 / 350; // width / height of public/branding/logo-pdf.png

  let cachedFontBase64: string | null = null;
  let cachedLogoBase64: string | null = null;

  export function bufferToBase64(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  async function loadFontBase64(): Promise<string> {
    if (cachedFontBase64) return cachedFontBase64;
    const res = await fetch(FONT_URL);
    if (!res.ok) throw new Error(`Failed to load PDF font: ${res.status}`);
    cachedFontBase64 = bufferToBase64(await res.arrayBuffer());
    return cachedFontBase64;
  }

  export async function loadLogoBase64(): Promise<string> {
    if (cachedLogoBase64) return cachedLogoBase64;
    const res = await fetch(LOGO_URL);
    if (!res.ok) throw new Error(`Failed to load PDF logo: ${res.status}`);
    cachedLogoBase64 = bufferToBase64(await res.arrayBuffer());
    return cachedLogoBase64;
  }
  ```

- [ ] **Step 5: Run the tests to verify they pass**

  Run: `npx vitest run components/bill-pdf.test.ts`
  Expected: PASS (2 tests)

- [ ] **Step 6: Draw the logo at the top of the generated bill**

  In `generateBillPdf`, change the start of the function from:
  ```ts
  export async function generateBillPdf(
    sale: Sale,
    items: SaleItem[],
    opts: Options
  ) {
    const fontBase64 = await loadFontBase64();
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.addFileToVFS(`${FONT_NAME}.ttf`, fontBase64);
    doc.addFont(`${FONT_NAME}.ttf`, FONT_NAME, "normal");

    let y = 15;
    const left = 15;
    const right = 195;

    doc.setFont(FONT_NAME, "normal");
    doc.setFontSize(18);
    doc.text(opts.shopName, left, y);
    y += 6;
  ```
  to:
  ```ts
  export async function generateBillPdf(
    sale: Sale,
    items: SaleItem[],
    opts: Options
  ) {
    const [fontBase64, logoBase64] = await Promise.all([
      loadFontBase64(),
      // A missing/broken logo must never block generating a bill — a core,
      // revenue-critical operation — so this failure is swallowed, not thrown.
      loadLogoBase64().catch(() => null),
    ]);
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.addFileToVFS(`${FONT_NAME}.ttf`, fontBase64);
    doc.addFont(`${FONT_NAME}.ttf`, FONT_NAME, "normal");

    const left = 15;
    const right = 195;
    let y = 15;

    if (logoBase64) {
      const logoWidth = 20;
      const logoHeight = logoWidth / LOGO_ASPECT;
      doc.addImage(
        `data:image/png;base64,${logoBase64}`,
        "PNG",
        105 - logoWidth / 2,
        8,
        logoWidth,
        logoHeight
      );
      y = 8 + logoHeight + 6;
    }

    doc.setFont(FONT_NAME, "normal");
    doc.setFontSize(18);
    doc.text(opts.shopName, 105, y, { align: "center" });
    y += 6;
  ```
  (Shop name switches from left-aligned to center-aligned so it lines up under the now-centered logo. Nothing below this point in the function — GSTIN, bill number, item table, totals — needs to change.)

- [ ] **Step 7: Manually verify the full PDF**

  Run `npm run dev`, open an existing sale at `/sales/[id]`, click the PDF download button. Confirm the logo appears centered at the top, above the shop name, and the rest of the bill (items, totals, footer) still renders correctly with no overlap.

- [ ] **Step 8: Commit**

  ```bash
  git add public/branding/logo-pdf.png components/bill-pdf.ts components/bill-pdf.test.ts
  git commit -m "feat: embed shop logo on generated PDF bills"
  ```
