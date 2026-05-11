"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { adjustStock } from "@/lib/sales";
import type { Product, StockAdjustment } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductPicker } from "@/components/product-picker";

type Mode = "set" | "adjust";
type Row = {
  product: Product;
  mode: Mode;
  value: string;
  reason: string;
};

type LogEntry = StockAdjustment & { product_name: string };

export default function StockPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const loadLog = async () => {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("stock_adjustments")
      .select("*, products(name)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      setErr(error.message);
      return;
    }
    setLog(
      (
        (data ?? []) as Array<
          StockAdjustment & { products: { name: string } | null }
        >
      ).map((r) => ({ ...r, product_name: r.products?.name ?? "(deleted)" }))
    );
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await loadLog();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const addProduct = (p: Product) => {
    setRows((curr) =>
      curr.some((r) => r.product.id === p.id)
        ? curr
        : [...curr, { product: p, mode: "set", value: "", reason: "" }]
    );
  };

  const update = (id: string, patch: Partial<Row>) =>
    setRows((curr) =>
      curr.map((r) => (r.product.id === id ? { ...r, ...patch } : r))
    );

  const remove = (id: string) =>
    setRows((curr) => curr.filter((r) => r.product.id !== id));

  const selectedIds = rows.map((r) => r.product.id);
  const pending = rows.filter(
    (r) => r.value !== "" && !isNaN(Number(r.value))
  );

  const save = async () => {
    setErr(null);
    setOk(null);
    setSaving(true);
    try {
      const entries = pending.map((r) => ({
        product_id: r.product.id,
        mode: r.mode,
        value: Number(r.value),
        reason: r.reason.trim() || null,
      }));
      const supabase = createSupabaseBrowserClient();
      const count = await adjustStock(supabase, entries);
      setOk(`${count} product${count === 1 ? "" : "s"} updated.`);
      setRows([]);
      await loadLog();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold">End-of-day stock</h1>
        <Button
          variant="brand"
          onClick={save}
          disabled={saving || pending.length === 0}
        >
          {saving ? "Saving..." : `Save ${pending.length || ""} changes`}
        </Button>
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Search and pick the products you want to update. Use <strong>Set to</strong>{" "}
        for a fresh count, or <strong>Adjust by</strong> a delta
        (<code>-3</code> for offline sales, <code>+10</code> for restock).
      </p>

      <section className="flex flex-col gap-2">
        <label className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Add product to update
        </label>
        <ProductPicker
          onAdd={addProduct}
          excludeIds={selectedIds}
          includeOutOfStock
          placeholder="Search by name…"
        />
      </section>

      {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
      {ok && <p className="text-sm text-emerald-700 dark:text-emerald-400">{ok}</p>}

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
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
              <li
                key={r.product.id}
                className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.product.name}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                      {r.product.stock}
                      {preview !== null && (
                        <>
                          {" → "}
                          <span
                            className={
                              invalid
                                ? "text-red-600 dark:text-red-400 font-semibold"
                                : "font-semibold text-zinc-900 dark:text-zinc-50"
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
                    className="p-1 text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
                    aria-label={`Remove ${r.product.name}`}
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                  <div className="flex rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-800 text-sm w-fit">
                    <button
                      type="button"
                      onClick={() =>
                        update(r.product.id, { mode: "set", value: "" })
                      }
                      className={`px-3 py-1.5 ${
                        r.mode === "set"
                          ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                          : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      Set to
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        update(r.product.id, { mode: "adjust", value: "" })
                      }
                      className={`px-3 py-1.5 border-l border-zinc-200 dark:border-zinc-800 ${
                        r.mode === "adjust"
                          ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                          : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
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
                    onChange={(e) =>
                      update(r.product.id, { value: e.target.value })
                    }
                    className="sm:w-28 tabular-nums"
                    aria-label={
                      r.mode === "set"
                        ? `Set stock for ${r.product.name}`
                        : `Adjust stock for ${r.product.name}`
                    }
                  />
                  <Input
                    placeholder="Reason (optional)"
                    value={r.reason}
                    onChange={(e) =>
                      update(r.product.id, { reason: e.target.value })
                    }
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
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No history yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {log.map((e) => (
              <li
                key={e.id}
                className="border-b border-zinc-100 dark:border-zinc-800 py-1.5 flex items-center gap-2 flex-wrap"
              >
                <span className="text-zinc-500 dark:text-zinc-400 text-xs w-32 shrink-0">
                  {new Date(e.created_at).toLocaleString("en-IN")}
                </span>
                <span className="flex-1 truncate">{e.product_name}</span>
                <span className="text-zinc-600 dark:text-zinc-400 tabular-nums">
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
                {e.reason && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    · {e.reason}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
