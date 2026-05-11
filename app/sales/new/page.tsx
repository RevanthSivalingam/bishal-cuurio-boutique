"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CartLine, Product } from "@/lib/schemas";
import { createSaleInputSchema } from "@/lib/schemas";
import {
  createSale,
  computeSubtotal,
  computeDiscountAmount,
  computeTotal,
  fetchSale,
} from "@/lib/sales";
import { ProductPicker } from "@/components/product-picker";
import { Cart } from "@/components/cart";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/money";

const nowLocalDatetime = () => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 16);
};

export default function NewSalePageWrapper() {
  return (
    <Suspense fallback={null}>
      <NewSalePage />
    </Suspense>
  );
}

function NewSalePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const duplicateFrom = searchParams.get("duplicate");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [discountPct, setDiscountPct] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [showCustomer, setShowCustomer] = useState(false);
  const channel: "online" | "offline" = "offline";
  const [saleDate, setSaleDate] = useState(nowLocalDatetime);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill from an existing bill when /sales/new?duplicate=<id>
  useEffect(() => {
    if (!duplicateFrom) return;
    let cancelled = false;
    const run = async () => {
      const supabase = createSupabaseBrowserClient();
      try {
        const { sale, items } = await fetchSale(supabase, duplicateFrom);
        if (cancelled) return;
        const { data: products } = await supabase
          .from("products")
          .select("id, stock")
          .in(
            "id",
            items
              .map((i) => i.product_id)
              .filter((v): v is string => v !== null)
          );
        if (cancelled) return;
        const stockById = new Map<string, number>(
          ((products ?? []) as Array<{ id: string; stock: number }>).map((p) => [
            p.id,
            p.stock,
          ])
        );
        setLines(
          items
            .filter((i) => i.product_id)
            .map((i) => ({
              product_id: i.product_id as string,
              product_name: i.product_name,
              quantity: i.quantity,
              unit_sell_price: i.unit_sell_price,
              stock_at_add: stockById.get(i.product_id as string) ?? 0,
            }))
        );
        setDiscountPct(sale.discount_pct);
        if (sale.customer_name || sale.customer_phone) {
          setCustomerName(sale.customer_name ?? "");
          setCustomerPhone(sale.customer_phone ?? "");
          setShowCustomer(true);
        }
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error
              ? `Could not duplicate: ${e.message}`
              : "Could not duplicate bill"
          );
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [duplicateFrom]);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "n" || e.key === "/") {
        e.preventDefault();
        const search = document.querySelector<HTMLInputElement>(
          'input[role="combobox"]'
        );
        search?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const checkout = async () => {
    setError(null);
    const occurred_at = saleDate ? new Date(saleDate).toISOString() : undefined;
    const parsed = createSaleInputSchema.safeParse({
      items: lines,
      discount_pct: discountPct,
      customer_name: customerName,
      customer_phone: customerPhone,
      channel,
      occurred_at,
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
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(20);
      }
      router.push(`/sales/${sale.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <h1 className="text-3xl font-[family-name:var(--font-display)] font-semibold tracking-tight">
        New sale
      </h1>

      <section className="flex flex-col gap-2 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <label className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Sale date &amp; time
        </label>
        <Input
          type="datetime-local"
          value={saleDate}
          onChange={(e) => setSaleDate(e.target.value)}
          className="w-fit"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Defaults to now. Backdate for sales captured at the end of the day.
        </p>
      </section>

      <section>
        <h2 className="font-medium mb-2">Add product</h2>
        <ProductPicker onAdd={addProduct} excludeIds={excludeIds} />
      </section>

      <section>
        <h2 className="font-medium mb-2">Cart</h2>
        <Cart lines={lines} onChange={setLines} />
      </section>

      <section className="flex flex-col gap-2 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800">
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
              setDiscountPct(
                Math.min(100, Math.max(0, Number(e.target.value) || 0))
              )
            }
            className="w-24 text-right"
          />
        </div>
        <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
          <span>Discount amount</span>
          <span>- {formatINR(discountAmount)}</span>
        </div>
        <div className="flex justify-between font-semibold text-lg pt-2 border-t border-zinc-200 dark:border-zinc-800">
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

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <Button
        type="button"
        variant="brand"
        size="lg"
        onClick={checkout}
        disabled={submitting || lines.length === 0}
      >
        {submitting ? "Processing..." : `Checkout · ${formatINR(total)}`}
      </Button>
    </div>
  );
}
