"use client";

import { useEffect, useMemo, useState } from "react";
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
  const days = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / 86400000) + 1
  );
  const buckets = new Array(days).fill(0) as number[];
  for (const s of sales) {
    const t = new Date(s.occurred_at);
    const d = Math.floor((t.getTime() - start.getTime()) / 86400000);
    if (d >= 0 && d < days) buckets[d] += s.total;
  }
  return buckets;
}

export default function ReportsPage() {
  const [from, setFrom] = useState(startOfMonthISO());
  const [to, setTo] = useState(todayISO());
  const [sales, setSales] = useState<Sale[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    const fromIso = new Date(`${from}T00:00:00`).toISOString();
    const toIso = new Date(`${to}T23:59:59.999`).toISOString();
    const run = async () => {
      setLoading(true);
      try {
        const [report, low] = await Promise.all([
          fetchReportData(supabase, fromIso, toIso),
          supabase.from("products").select("*").order("stock", { ascending: true }),
        ]);
        if (cancelled) return;
        setSales(report.sales);
        setItems(report.items);
        const prods = (low.data ?? []) as Product[];
        setLowStock(prods.filter((p) => p.stock <= p.low_stock_threshold));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [from, to]);

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
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="w-auto"
        />
        <span className="text-zinc-500 dark:text-zinc-400 text-sm">to</span>
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="w-auto"
        />
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[70px] rounded-xl" />
            ))
          : (
              <>
                <StatCard label="Sales" value={formatINR(totalSales)} />
                <StatCard label="Profit" value={formatINR(totalProfit)} emphasis />
                <StatCard label="Bills" value={String(sales.length)} />
                <StatCard label="Items sold" value={String(itemsSold)} />
              </>
            )}
      </section>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium">Daily sales</h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {daily.length} {daily.length === 1 ? "day" : "days"}
          </span>
        </div>
        {loading ? (
          <Skeleton className="h-[60px]" />
        ) : totalSales === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 py-4">No sales in range.</p>
        ) : (
          <Sparkline
            values={daily}
            height={60}
            aria-label="Daily sales trend for the selected range"
          />
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
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No sales in range.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {topProducts.map((p) => (
              <li
                key={p.name}
                className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 py-2"
              >
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
          <p className="text-sm text-zinc-500 dark:text-zinc-400">All products above threshold.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {lowStock.map((p) => (
              <li
                key={p.id}
                className="flex justify-between border-b border-zinc-100 dark:border-zinc-800 py-2"
              >
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

function StatCard({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`border rounded-xl p-3 ${
        emphasis
          ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950"
          : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
      }`}
    >
      <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{label}</p>
      <p
        className={`font-semibold text-lg tabular-nums ${
          emphasis ? "text-emerald-800 dark:text-emerald-200" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
