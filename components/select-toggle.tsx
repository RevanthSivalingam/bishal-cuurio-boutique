"use client";

import { Plus } from "lucide-react";
import { useSelection } from "@/components/selection-provider";
import type { NewSelectedItem } from "@/lib/selection";

type Props = {
  item: NewSelectedItem;
  size?: "sm" | "lg";
};

export function SelectToggle({ item, size = "sm" }: Props) {
  const { items, add, increment } = useSelection();
  const stored = items.find((i) => i.id === item.id);
  const selected = stored !== undefined;

  const sizeClass = size === "lg" ? "h-12 px-4 text-sm rounded-lg" : "size-8 rounded-full p-0";
  const toneClass = selected
    ? "bg-brass-deep border-brass-deep text-white dark:text-[#14130f]"
    : "bg-paper/90 backdrop-blur border-paper-edge text-ink hover:border-brass";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // Repeated taps build up quantity rather than toggling off — removing
        // an item is only available from the floating bar's own remove button,
        // so a mis-tap on the card never accidentally drops a selection.
        if (selected) increment(item.id);
        else add(item);
      }}
      aria-label={
        selected
          ? `${item.name}: ${stored.quantity} selected, tap to add one more`
          : `Add ${item.name} to selection`
      }
      aria-pressed={selected}
      className={`inline-flex items-center justify-center gap-2 border font-medium transition-colors ${sizeClass} ${toneClass}`}
    >
      {selected ? (
        <span className="tabular-nums font-semibold">{stored.quantity}</span>
      ) : (
        <Plus className="size-4" />
      )}
      {size === "lg" && (selected ? "Selected" : "Select")}
    </button>
  );
}
