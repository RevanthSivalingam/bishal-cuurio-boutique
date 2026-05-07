"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchReportData, computeProfit } from "@/lib/sales";
import type { Sale, SaleItem, Product } from "@/lib/schemas";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/lib/money";

const startOfMonthISO = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function ReportsPage() {
  const [from, setFrom] = useState(startOfMonthISO());
  const [to, setTo] = useState(todayISO());
  const [sales, setSales] = useState<Sale[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

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
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Reports</h1>

      <div className="flex gap-2 flex-wrap items-center">
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="w-auto"
        />
        <span>to</span>
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="w-auto"
        />
      </div>

      {loading && <p className="text-sm text-zinc-500">Loading...</p>}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Sales" value={formatINR(totalSales)} />
        <Card label="Profit" value={formatINR(totalProfit)} />
        <Card label="Bills" value={String(sales.length)} />
        <Card label="Items sold" value={String(itemsSold)} />
      </section>

      <section>
        <h2 className="font-medium mb-2">Top products</h2>
        {topProducts.length === 0 ? (
          <p className="text-sm text-zinc-500">No sales in range.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {topProducts.map((p) => (
              <li
                key={p.name}
                className="flex justify-between border-b border-zinc-100 py-1"
              >
                <span>{p.name}</span>
                <span>{p.qty}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-medium mb-2">Low stock warning</h2>
        {lowStock.length === 0 ? (
          <p className="text-sm text-zinc-500">All products above threshold.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {lowStock.map((p) => (
              <li
                key={p.id}
                className="flex justify-between border-b border-zinc-100 py-1"
              >
                <span>{p.name}</span>
                <span className="text-red-600">
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

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-200 rounded-xl p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="font-semibold text-lg">{value}</p>
    </div>
  );
}
