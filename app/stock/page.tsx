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
