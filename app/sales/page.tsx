"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
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
  const [date, setDate] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "void">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useInfiniteQuery({
    queryKey: ["sales", { date, status, debouncedSearch }],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const supabase = createSupabaseBrowserClient();
      const from = date ? new Date(`${date}T00:00:00`).toISOString() : undefined;
      const to = date ? new Date(`${date}T23:59:59.999`).toISOString() : undefined;
      return listSales(supabase, {
        from,
        to,
        status: status === "all" ? undefined : status,
        search: debouncedSearch || undefined,
        limit: PAGE_SIZE,
        offset: pageParam,
      });
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((n, p) => n + p.rows.length, 0);
      return loaded < lastPage.count ? loaded : undefined;
    },
  });

  const rows = data?.pages.flatMap((p) => p.rows) ?? [];
  const count = data?.pages.at(-1)?.count ?? 0;
  const filtersActive = Boolean(date || debouncedSearch || status !== "all");

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
            <Button variant="ghost" size="sm" onClick={() => setDate("")} aria-label="Clear date filter">
              Clear
            </Button>
          )}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="ml-auto h-11 border border-border rounded-lg px-3 text-sm bg-surface"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="void">Void</option>
          </select>
        </div>
      </div>

      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm">
          {error instanceof Error ? error.message : "Load failed"}
        </p>
      )}

      {isLoading ? (
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
            filtersActive ? "Try a different date, name, or phone number." : "Ready to ring up your first sale?"
          }
          action={
            <Link href="/sales/new">
              <Button variant="brand">+ New sale</Button>
            </Link>
          }
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {count} {count === 1 ? "bill" : "bills"}
          </p>
          <ul className="flex flex-col gap-2">
            {rows.map((s: Sale) => (
              <li key={s.id}>
                <Link
                  href={`/sales/${s.id}`}
                  className="block border border-border rounded-xl p-3 hover:bg-surface-muted"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{s.bill_number}</span>
                    <span
                      className={
                        s.status === "void" ? "text-red-600 dark:text-red-400 text-xs" : "text-xs text-muted-foreground"
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
                    <span className="text-muted-foreground truncate flex items-center gap-2">
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

          {hasNextPage && (
            <Button
              variant="outline"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="self-center"
            >
              {isFetchingNextPage ? "Loading…" : `Show more (${count - rows.length} left)`}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
