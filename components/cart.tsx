"use client";

import { Trash2, Minus, Plus } from "lucide-react";
import type { CartLine } from "@/lib/schemas";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/money";

type Props = {
  lines: CartLine[];
  onChange: (lines: CartLine[]) => void;
};

export function Cart({ lines, onChange }: Props) {
  if (lines.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Cart is empty. Add products above.</p>;
  }

  const update = (idx: number, patch: Partial<CartLine>) =>
    onChange(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const remove = (idx: number) => onChange(lines.filter((_, i) => i !== idx));

  return (
    <ul className="flex flex-col gap-3">
      {lines.map((l, idx) => {
        const overStock = l.quantity > l.stock_at_add;
        return (
          <li
            key={`${l.product_id}-${idx}`}
            className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 flex flex-col gap-2"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium truncate">{l.product_name}</p>
              <button
                type="button"
                onClick={() => remove(idx)}
                className="text-red-600 dark:text-red-400 p-1"
                aria-label="Remove line"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => update(idx, { quantity: Math.max(1, l.quantity - 1) })}
                aria-label="Decrease quantity"
              >
                <Minus className="size-4" />
              </Button>
              <Input
                type="number"
                min={1}
                max={l.stock_at_add}
                value={l.quantity}
                onChange={(e) =>
                  update(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })
                }
                className="w-16 text-center"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() =>
                  update(idx, { quantity: Math.min(l.stock_at_add, l.quantity + 1) })
                }
                aria-label="Increase quantity"
              >
                <Plus className="size-4" />
              </Button>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">of {l.stock_at_add}</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-zinc-600 dark:text-zinc-400 shrink-0">Price</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={l.unit_sell_price}
                onChange={(e) =>
                  update(idx, {
                    unit_sell_price: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
            </div>
            <p className="text-right font-semibold">
              {formatINR(l.unit_sell_price * l.quantity)}
            </p>
            {overStock && (
              <p className="text-sm text-red-600 dark:text-red-400">Exceeds stock ({l.stock_at_add})</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
