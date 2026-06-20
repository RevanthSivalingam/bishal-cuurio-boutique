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

const PAGE_SIZE = 10;

export default function SalesListPage() {
  const [date, setDate] = useState(""); // empty = all history
  const [status, setStatus] = useState<"all" | "active" | "void">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [rows, setRows] = useState<Sale[]>([]);
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Debounce the search box (~300ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to first page whenever a filter changes
  useEffect(() => {
    setOffset(0);
  }, [date, status, debouncedSearch]);

  // Build the params shared by initial load and "show more"
  const buildParams = (nextOffset: number) => {
    const from = date ? new Date(`${date}T00:00:00`).toISOString() : undefined;
    const to = date ? new Date(`${date}T23:59:59.999`).toISOString() : undefined;
    return {
      from,
      to,
      status: status === "all" ? undefined : status,
      search: debouncedSearch || undefined,
      limit: PAGE_SIZE,
      offset: nextOffset,
    };
  };

  // Fetch first page (replaces rows) on any filter change
  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    const run = async () => {
      setLoading(true);
      setErr(null);
      try {
        const { rows: data, count: total } = await listSales(
          supabase,
          buildParams(0)
        );
        if (cancelled) return;
        setRows(data);
        setCount(total);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, status, debouncedSearch]);

  const showMore = async () => {
    const nextOffset = offset + PAGE_SIZE;
    setLoadingMore(true);
    setErr(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { rows: data, count: total } = await listSales(
        supabase,
        buildParams(nextOffset)
      );
      setRows((curr) => [...curr, ...data]);
      setCount(total);
      setOffset(nextOffset);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoadingMore(false);
    }
  };

  const filtersActive = Boolean(date || debouncedSearch || status !== "all");
  const hasMore = rows.length < count;

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold">Sales</h1>
        <Link href="/sales/new">
          <Button variant="brand">+ New sale</Button>
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or phone"
        />
        <div className="flex gap-2 items-center">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-[9.5rem] shrink-0"
          />
          {date && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDate("")}
              aria-label="Clear date filter"
            >
              Clear
            </Button>
          )}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="ml-auto h-11 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 text-sm bg-white dark:bg-zinc-900"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="void">Void</option>
          </select>
        </div>
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
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={filtersActive ? "No bills match" : "No sales yet"}
          description={
            filtersActive
              ? "Try a different date, name, or phone number."
              : "Ready to ring up your first sale?"
          }
          action={
            <Link href="/sales/new">
              <Button variant="brand">+ New sale</Button>
            </Link>
          }
        />
      ) : (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {count} {count === 1 ? "bill" : "bills"}
          </p>
          <ul className="flex flex-col gap-2">
            {rows.map((s) => (
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
                        : new Date(s.occurred_at).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
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

          {hasMore && (
            <Button
              variant="outline"
              onClick={showMore}
              disabled={loadingMore}
              className="self-center"
            >
              {loadingMore
                ? "Loading…"
                : `Show more (${count - rows.length} left)`}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
