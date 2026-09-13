"use client";

import { Check, Plus } from "lucide-react";
import { useSelection } from "@/components/selection-provider";
import type { NewSelectedItem } from "@/lib/selection";

type Props = {
  item: NewSelectedItem;
  size?: "sm" | "lg";
};

export function SelectToggle({ item, size = "sm" }: Props) {
  const { has, add, remove } = useSelection();
  const selected = has(item.id);

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
        if (selected) remove(item.id);
        else add(item);
      }}
      aria-label={selected ? `Remove ${item.name} from selection` : `Add ${item.name} to selection`}
      aria-pressed={selected}
      className={`inline-flex items-center justify-center gap-2 border font-medium transition-colors ${sizeClass} ${toneClass}`}
    >
      {selected ? <Check className="size-4" /> : <Plus className="size-4" />}
      {size === "lg" && (selected ? "Selected" : "Select")}
    </button>
  );
}
