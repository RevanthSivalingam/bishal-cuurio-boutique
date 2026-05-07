"use client";

import { useMemo, useState } from "react";
import { Search, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CatalogCard } from "@/components/catalog-card";
import type { Category, Product } from "@/lib/schemas";

type Props = {
  products: Product[];
  categories: Category[];
};

export function CatalogGrid({ products, categories }: Props) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categoryById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCategory && p.category_id !== activeCategory) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, search, activeCategory]);

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 gap-4">
        <div className="size-16 rounded-full bg-zinc-100 flex items-center justify-center">
          <Package className="size-8 text-zinc-400" />
        </div>
        <h2 className="font-medium text-lg">Catalog coming soon</h2>
        <p className="text-sm text-zinc-500 mt-1">
          No products have been listed yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
        <Input
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-none">
        <Chip
          label="All"
          active={activeCategory === null}
          onClick={() => setActiveCategory(null)}
        />
        {categories.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            active={activeCategory === c.id}
            onClick={() => setActiveCategory(c.id)}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-8">
          No products match your filter.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <CatalogCard
              key={p.id}
              product={p}
              category={p.category_id ? categoryById[p.category_id] : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 px-3 py-1 rounded-full text-sm border transition-colors ${
        active
          ? "bg-zinc-900 text-white border-zinc-900"
          : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50"
      }`}
    >
      {label}
    </button>
  );
}
