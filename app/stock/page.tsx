"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { adjustStock } from "@/lib/sales";
import type { Product, StockAdjustment } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const [search, setSearch] = useState("");

  const load = async () => {
    const supabase = createSupabaseBrowserClient();
    const [{ data: prods, error: pErr }, { data: adj, error: aErr }] =
      await Promise.all([
        supabase.from("products").select("*").order("name"),
        supabase
          .from("stock_adjustments")
          .select("*, products(name)")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
    if (pErr) {
      setErr(pErr.message);
      return;
    }
    if (aErr) {
      setErr(aErr.message);
      return;
    }
    setRows(
      ((prods ?? []) as Product[]).map((p) => ({
        product: p,
        mode: "set",
        value: "",
        reason: "",
      }))
    );
    setLog(
      ((adj ?? []) as Array<StockAdjustment & { products: { name: string } | null }>).map(
        (r) => ({
          ...r,
          product_name: r.products?.name ?? "(deleted)",
        })
      )
    );
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await load();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.product.name.toLowerCase().includes(q));
  }, [rows, search]);

  const update = (id: string, patch: Partial<Row>) =>
    setRows((curr) =>
      curr.map((r) => (r.product.id === id ? { ...r, ...patch } : r))
    );

  const pending = rows.filter((r) => r.value !== "" && !isNaN(Number(r.value)));

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
      await load();
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
          onClick={save}
          disabled={saving || pending.length === 0}
        >
          {saving ? "Saving..." : `Save ${pending.length || ""} changes`}
        </Button>
      </div>

      <p className="text-sm text-zinc-600">
        Per row: <strong>Set to</strong> an absolute count, or <strong>Adjust by</strong> a delta
        (e.g. <code>-3</code> for offline sales, <code>+10</code> for restock). Rows with empty
        inputs are ignored.
      </p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
        <Input
          placeholder="Search product..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
      {ok && <p className="text-sm text-green-700">{ok}</p>}
      {loading && <p className="text-sm text-zinc-500">Loading...</p>}

      <ul className="flex flex-col gap-2">
        {filtered.map((r) => {
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
              className="border border-zinc-200 rounded-xl p-3 flex flex-col gap-2 md:flex-row md:items-center md:gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{r.product.name}</p>
                <p className="text-xs text-zinc-500">
                  current: {r.product.stock}
                  {preview !== null && (
                    <>
                      {" → "}
                      <span className={invalid ? "text-red-600" : "font-medium"}>
                        {preview}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex rounded-md overflow-hidden border border-zinc-200 text-sm">
                  <button
                    type="button"
                    onClick={() => update(r.product.id, { mode: "set", value: "" })}
                    className={`px-3 py-1 ${
                      r.mode === "set"
                        ? "bg-zinc-900 text-white"
                        : "bg-white text-zinc-700"
                    }`}
                  >
                    Set to
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      update(r.product.id, { mode: "adjust", value: "" })
                    }
                    className={`px-3 py-1 border-l border-zinc-200 ${
                      r.mode === "adjust"
                        ? "bg-zinc-900 text-white"
                        : "bg-white text-zinc-700"
                    }`}
                  >
                    Adjust by
                  </button>
                </div>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder={r.mode === "set" ? "e.g. 15" : "e.g. -3"}
                  value={r.value}
                  onChange={(e) =>
                    update(r.product.id, { value: e.target.value })
                  }
                  className="w-28"
                />
                <Input
                  placeholder="Reason (optional)"
                  value={r.reason}
                  onChange={(e) =>
                    update(r.product.id, { reason: e.target.value })
                  }
                  className="flex-1 min-w-0"
                />
              </div>
            </li>
          );
        })}
        {!loading && filtered.length === 0 && (
          <li className="text-sm text-zinc-500">No products.</li>
        )}
      </ul>

      <section className="mt-4">
        <h2 className="font-medium mb-2">Recent adjustments</h2>
        {log.length === 0 ? (
          <p className="text-sm text-zinc-500">No history yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {log.map((e) => (
              <li
                key={e.id}
                className="border-b border-zinc-100 py-1 flex items-center gap-2 flex-wrap"
              >
                <span className="text-zinc-500 text-xs w-32 shrink-0">
                  {new Date(e.created_at).toLocaleString("en-IN")}
                </span>
                <span className="flex-1 truncate">{e.product_name}</span>
                <span className="text-zinc-600">
                  {e.old_stock} → {e.new_stock}
                </span>
                <span
                  className={`px-1.5 rounded ${
                    e.delta >= 0
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  } text-xs`}
                >
                  {e.delta >= 0 ? "+" : ""}
                  {e.delta}
                </span>
                {e.reason && <span className="text-xs text-zinc-500">· {e.reason}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
