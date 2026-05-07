"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Product } from "@/lib/schemas";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/money";

type Props = {
  onAdd: (p: Product) => void;
  excludeIds?: string[];
};

export function ProductPicker({ onAdd, excludeIds = [] }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const controller = new AbortController();
    const run = async () => {
      setLoading(true);
      const base = supabase
        .from("products")
        .select("*")
        .gt("stock", 0)
        .order("name")
        .limit(20);
      const { data } = query.trim()
        ? await base.ilike("name", `%${query.trim()}%`)
        : await base;
      if (!controller.signal.aborted) {
        const filtered = (data ?? []).filter((p) => !excludeIds.includes(p.id));
        setResults(filtered as Product[]);
        setLoading(false);
      }
    };
    const t = setTimeout(run, 200);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, excludeIds.join(",")]);

  return (
    <div className="flex flex-col gap-2">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search product by name..."
        autoFocus
      />
      <ul className="flex flex-col gap-1 max-h-64 overflow-y-auto">
        {loading && <li className="text-sm text-zinc-500 px-1">Loading...</li>}
        {!loading && results.length === 0 && (
          <li className="text-sm text-zinc-500 px-1">No matching in-stock products.</li>
        )}
        {results.map((p) => (
          <li key={p.id}>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between"
              onClick={() => onAdd(p)}
            >
              <span className="truncate text-left">{p.name}</span>
              <span className="text-xs text-zinc-500 shrink-0">
                {formatINR(p.selling_price)} · stock {p.stock}
              </span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
