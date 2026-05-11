"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Package, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/product-card";
import type { Category, Product } from "@/lib/schemas";

type Props = {
  products: Product[];
  categories: Category[];
};

export function InventoryGrid({ products, categories }: Props) {
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
        <div className="size-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <Package className="size-8 text-zinc-400 dark:text-zinc-500" />
        </div>
        <div>
          <h2 className="font-medium text-lg">No products yet</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Add your first product to start tracking stock and margins.
          </p>
        </div>
        <Link href="/inventory/new">
          <Button size="lg">
            <Plus className="size-4" />
            Add your first product
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400 dark:text-zinc-500" />
        <Input
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-none">
        <CategoryChip
          label="All"
          active={activeCategory === null}
          onClick={() => setActiveCategory(null)}
        />
        {categories.map((c) => (
          <CategoryChip
            key={c.id}
            label={c.name}
            active={activeCategory === c.id}
            onClick={() => setActiveCategory(c.id)}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-10">
          No products match your filters.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((p) => (
            <ProductCard
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

function CategoryChip({
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
      className={
        "shrink-0 px-3 h-9 rounded-full text-sm font-medium transition-colors " +
        (active
          ? "bg-zinc-900 dark:bg-zinc-100 text-white"
          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200")
      }
    >
      {label}
    </button>
  );
}
