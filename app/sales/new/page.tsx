"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CartLine, Product } from "@/lib/schemas";
import { createSaleInputSchema } from "@/lib/schemas";
import {
  createSale,
  computeSubtotal,
  computeDiscountAmount,
  computeTotal,
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

export default function NewSalePage() {
  const router = useRouter();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [discountPct, setDiscountPct] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [showCustomer, setShowCustomer] = useState(false);
  const [channel, setChannel] = useState<"online" | "offline">("online");
  const [saleDate, setSaleDate] = useState(nowLocalDatetime);
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
      router.push(`/sales/${sale.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">New sale</h1>

      <section className="flex flex-col gap-3 p-4 rounded-xl border border-zinc-200">
        <div>
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Channel
          </label>
          <div className="mt-1 flex rounded-md overflow-hidden border border-zinc-200 w-fit text-sm">
            <button
              type="button"
              onClick={() => setChannel("online")}
              className={`px-4 py-1 ${
                channel === "online"
                  ? "bg-zinc-900 text-white"
                  : "bg-white text-zinc-700"
              }`}
            >
              Online
            </button>
            <button
              type="button"
              onClick={() => setChannel("offline")}
              className={`px-4 py-1 border-l border-zinc-200 ${
                channel === "offline"
                  ? "bg-zinc-900 text-white"
                  : "bg-white text-zinc-700"
              }`}
            >
              Offline
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Sale date &amp; time
          </label>
          <Input
            type="datetime-local"
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
            className="mt-1 w-fit"
          />
          <p className="text-xs text-zinc-500 mt-1">
            Defaults to now. Backdate here for offline sales captured at the end of the day.
          </p>
        </div>
      </section>

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
              setDiscountPct(
                Math.min(100, Math.max(0, Number(e.target.value) || 0))
              )
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
        {submitting
          ? "Processing..."
          : `Checkout${channel === "offline" ? " (offline)" : ""} · ${formatINR(total)}`}
      </Button>
    </div>
  );
}
