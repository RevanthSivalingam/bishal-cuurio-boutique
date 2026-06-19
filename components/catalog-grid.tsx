"use client";

import { useMemo, useState } from "react";
import { Search, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
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

  const countsByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) {
      if (!p.category_id) continue;
      m.set(p.category_id, (m.get(p.category_id) ?? 0) + 1);
    }
    return m;
  }, [products]);

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
      <EmptyState
        icon={Package}
        title="The shelves are being set"
        description="New pieces are on their way. Check back soon to see what's arrived."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
        <Input
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          aria-label="Search products"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-none">
        <Chip
          label={`All · ${products.length}`}
          active={activeCategory === null}
          onClick={() => setActiveCategory(null)}
        />
        {categories.map((c) => {
          const count = countsByCategory.get(c.id) ?? 0;
          if (count === 0) return null;
          return (
            <Chip
              key={c.id}
              label={`${c.name} · ${count}`}
              active={activeCategory === c.id}
              onClick={() => setActiveCategory(c.id)}
            />
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-mist text-center py-8">
          Nothing here matches — try a different word or category.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 reveal">
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
      className={`shrink-0 px-3 py-1.5 rounded-full text-sm border transition-colors tabular-nums ${
        active
          ? "bg-brass-deep text-white border-brass-deep dark:text-[#14130f]"
          : "bg-paper border-paper-edge text-mist hover:text-ink hover:border-brass"
      }`}
    >
      {label}
    </button>
  );
}
