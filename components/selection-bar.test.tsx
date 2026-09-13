import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname } from "next/navigation";
import { SelectionBar } from "./selection-bar";
import { SelectionProvider } from "./selection-provider";
import { writeSelection, type SelectedItem } from "@/lib/selection";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

const vase: SelectedItem = { id: "1", name: "Brass Vase", price: 450, quantity: 1 };
const lamp: SelectedItem = { id: "2", name: "Ceramic Lamp", price: 1200, quantity: 1 };

function renderBar() {
  return render(
    <SelectionProvider>
      <SelectionBar />
    </SelectionProvider>
  );
}

describe("SelectionBar", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(usePathname).mockReturnValue("/");
  });

  it("stays mounted but inert/hidden when the selection is empty", () => {
    // Deliberately NOT unmounted (no `return null`) — see the comment in
    // selection-bar.tsx on why: iOS Safari can mis-anchor a `fixed` element
    // inserted into the DOM mid-scroll, so the bar stays present and is
    // hidden visually/interactively instead.
    renderBar();
    const bar = screen.getByText("0 selected").closest("div[inert]");
    expect(bar).not.toBeNull();
    expect(bar).toHaveClass("translate-y-full", "pointer-events-none");
  });

  it("renders nothing on a non-storefront pathname even with items selected", () => {
    vi.mocked(usePathname).mockReturnValue("/inventory");
    writeSelection([vase]);

    const { container } = renderBar();

    expect(container).toBeEmptyDOMElement();
  });

  it.each(["/", "/product/123"])(
    "renders the bar with the correct count on storefront pathname %s",
    (pathname) => {
      vi.mocked(usePathname).mockReturnValue(pathname);
      writeSelection([vase, lamp]);

      renderBar();

      expect(screen.getByText("2 selected")).toBeInTheDocument();
    }
  );

  it("clicking Clear all empties the selection and hides the bar again", async () => {
    writeSelection([vase, lamp]);
    renderBar();

    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));

    const bar = screen.getByText("0 selected").closest("div[inert]");
    expect(bar).not.toBeNull();
    expect(bar).toHaveClass("translate-y-full", "pointer-events-none");
  });

  it("removing one item from the expanded list updates the count", async () => {
    writeSelection([vase, lamp]);
    renderBar();

    await userEvent.click(screen.getByRole("button", { name: "2 selected" }));
    await userEvent.click(screen.getByRole("button", { name: `Remove ${vase.name}` }));

    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.queryByText(vase.name)).not.toBeInTheDocument();
    expect(screen.getByText(lamp.name)).toBeInTheDocument();
  });

  it("increasing quantity via + updates the displayed quantity, not the selected count", async () => {
    writeSelection([vase]);
    renderBar();

    await userEvent.click(screen.getByRole("button", { name: "1 selected" }));
    await userEvent.click(screen.getByRole("button", { name: `Increase quantity of ${vase.name}` }));

    expect(screen.getByText("2")).toBeInTheDocument();
    // Distinct-item count is unchanged — quantity is not the same as item count.
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("decreasing quantity floors at 1 — the minus button is disabled at quantity 1", async () => {
    writeSelection([vase]);
    renderBar();

    await userEvent.click(screen.getByRole("button", { name: "1 selected" }));
    const minus = screen.getByRole("button", { name: `Decrease quantity of ${vase.name}` });

    expect(minus).toBeDisabled();
    await userEvent.click(minus);
    expect(screen.getByText(vase.name)).toBeInTheDocument(); // still present, not removed
  });
});

describe("SelectionBar wa.me link construction", () => {
  const originalEnv = process.env.NEXT_PUBLIC_SHOP_WHATSAPP;

  beforeEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_SHOP_WHATSAPP;
    } else {
      process.env.NEXT_PUBLIC_SHOP_WHATSAPP = originalEnv;
    }
  });

  // `SHOP_WA` in selection-bar.tsx is computed once at module scope from
  // process.env.NEXT_PUBLIC_SHOP_WHATSAPP, mirroring enquire-button.tsx's constant.
  // To exercise both branches we must reset vitest's module registry and
  // dynamically re-import so the constant is recomputed against the new env value.
  async function loadFreshBar(rawNumber: string | undefined) {
    if (rawNumber === undefined) {
      delete process.env.NEXT_PUBLIC_SHOP_WHATSAPP;
    } else {
      process.env.NEXT_PUBLIC_SHOP_WHATSAPP = rawNumber;
    }

    const nav = await import("next/navigation");
    vi.mocked(nav.usePathname).mockReturnValue("/");

    const { writeSelection: freshWriteSelection } = await import("@/lib/selection");
    freshWriteSelection([vase]);

    const { SelectionProvider: FreshProvider } = await import("./selection-provider");
    const { SelectionBar: FreshBar } = await import("./selection-bar");
    return { FreshProvider, FreshBar };
  }

  it("uses the configured shop number, digits-only, when NEXT_PUBLIC_SHOP_WHATSAPP is set", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const { FreshProvider, FreshBar } = await loadFreshBar("+91 98765-43210");

    render(
      <FreshProvider>
        <FreshBar />
      </FreshProvider>
    );
    await userEvent.click(screen.getByRole("button", { name: /share via whatsapp/i }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url] = openSpy.mock.calls[0] as [string];
    expect(url.startsWith("https://wa.me/919876543210?text=")).toBe(true);
  });

  it("falls back to a bare wa.me link when NEXT_PUBLIC_SHOP_WHATSAPP is unset", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const { FreshProvider, FreshBar } = await loadFreshBar(undefined);

    render(
      <FreshProvider>
        <FreshBar />
      </FreshProvider>
    );
    await userEvent.click(screen.getByRole("button", { name: /share via whatsapp/i }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url] = openSpy.mock.calls[0] as [string];
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
  });
});
