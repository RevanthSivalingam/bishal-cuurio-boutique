"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { listSales } from "@/lib/sales";
import type { Sale } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatINR } from "@/lib/money";

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function SalesListPage() {
  const [date, setDate] = useState(todayISO());
  const [status, setStatus] = useState<"all" | "active" | "void">("all");
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    const from = new Date(`${date}T00:00:00`).toISOString();
    const to = new Date(`${date}T23:59:59.999`).toISOString();
    // (filters by sales.occurred_at — may include back-dated offline sales)
    const run = async () => {
      setLoading(true);
      try {
        const data = await listSales(
          supabase,
          from,
          to,
          status === "all" ? undefined : status
        );
        if (!cancelled) setSales(data);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Load failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [date, status]);

  const totalActive = sales
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + s.total, 0);

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold">Sales</h1>
        <Link href="/sales/new">
          <Button variant="brand">+ New sale</Button>
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-auto"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="border border-zinc-200 dark:border-zinc-800 rounded-md px-3 text-sm"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="void">Void</option>
        </select>
      </div>

      {err && <p className="text-red-600 dark:text-red-400 text-sm">{err}</p>}

      {loading ? (
        <ul className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i}>
              <Skeleton className="h-16 w-full rounded-xl" />
            </li>
          ))}
        </ul>
      ) : sales.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No bills for this date"
          description="Ready to ring up your first sale of the day?"
          action={
            <Link href="/sales/new">
              <Button variant="brand">+ New sale</Button>
            </Link>
          }
        />
      ) : (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {sales.length} bills · Total (active):{" "}
            <strong>{formatINR(totalActive)}</strong>
          </p>
          <ul className="flex flex-col gap-2">
            {sales.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/sales/${s.id}`}
                  className="block border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{s.bill_number}</span>
                    <span
                      className={
                        s.status === "void"
                          ? "text-red-600 dark:text-red-400 text-xs"
                          : "text-xs text-zinc-500 dark:text-zinc-400"
                      }
                    >
                      {s.status === "void"
                        ? "VOID"
                        : new Date(s.occurred_at).toLocaleTimeString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-1 items-center gap-2">
                    <span className="text-zinc-600 dark:text-zinc-400 truncate flex items-center gap-2">
                      {s.customer_name ?? "Walk-in"}
                      {s.channel === "offline" && (
                        <span className="text-xs px-1.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200">
                          Offline
                        </span>
                      )}
                    </span>
                    <span>{formatINR(s.total)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
