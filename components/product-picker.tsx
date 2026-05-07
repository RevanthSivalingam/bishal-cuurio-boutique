"use client";

import { useEffect, useRef, useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Product } from "@/lib/schemas";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/lib/money";

type Props = {
  onAdd: (p: Product) => void;
  excludeIds?: string[];
};

export function ProductPicker({ onAdd, excludeIds = [] }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const excludeKey = excludeIds.join(",");

  useEffect(() => {
    if (!open) return;
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
        setHighlight(0);
        setLoading(false);
      }
    };
    const t = setTimeout(run, 180);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, excludeKey]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const pick = (p: Product) => {
    onAdd(p);
    setQuery("");
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(results.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const p = results[highlight];
      if (p) pick(p);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400 pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder="Search product by name…"
          className="pl-10 pr-8"
          role="combobox"
          aria-expanded={open}
          aria-controls="product-picker-list"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400"
          aria-label="Toggle list"
          tabIndex={-1}
        >
          <ChevronDown className="size-4" />
        </button>
      </div>

      {open && (
        <ul
          id="product-picker-list"
          role="listbox"
          className="absolute z-10 mt-1 w-full max-h-72 overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg"
        >
          {loading && (
            <li className="px-3 py-2 text-sm text-zinc-500">Loading…</li>
          )}
          {!loading && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-zinc-500">
              No matching in-stock products.
            </li>
          )}
          {results.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                onClick={() => pick(p)}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                  i === highlight ? "bg-zinc-100" : "bg-white"
                }`}
              >
                <span className="truncate">{p.name}</span>
                <span className="text-xs text-zinc-500 shrink-0">
                  {formatINR(p.selling_price)} · {p.stock}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
