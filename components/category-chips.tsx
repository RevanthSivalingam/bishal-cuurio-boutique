"use client";

import type { Category } from "@/lib/schemas";

type Props = {
  categories: Category[];
  activeCategory: string | null;
  onSelect: (id: string | null) => void;
  counts?: Map<string, number>;
  totalCount?: number;
  variant: "storefront" | "admin";
};

export function CategoryChips({
  categories,
  activeCategory,
  onSelect,
  counts,
  totalCount,
  variant,
}: Props) {
  const visible = counts ? categories.filter((c) => (counts.get(c.id) ?? 0) > 0) : categories;

  return (
    <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-none">
      <Chip
        label={counts ? `All · ${totalCount ?? 0}` : "All"}
        active={activeCategory === null}
        onClick={() => onSelect(null)}
        variant={variant}
      />
      {visible.map((c) => (
        <Chip
          key={c.id}
          label={counts ? `${c.name} · ${counts.get(c.id) ?? 0}` : c.name}
          active={activeCategory === c.id}
          onClick={() => onSelect(c.id)}
          variant={variant}
        />
      ))}
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
  variant,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  variant: "storefront" | "admin";
}) {
  if (variant === "storefront") {
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
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 px-3 h-9 rounded-full text-sm font-medium transition-colors tabular-nums ${
        active ? "bg-foreground text-background" : "bg-surface-muted text-foreground hover:opacity-80"
      }`}
    >
      {label}
    </button>
  );
}
