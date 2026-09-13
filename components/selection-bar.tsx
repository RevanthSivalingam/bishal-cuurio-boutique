"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { MessageCircle, Minus, Plus, X } from "lucide-react";
import { useSelection } from "@/components/selection-provider";
import { buildWhatsAppMessage } from "@/lib/selection";

const SHOP_WA = (process.env.NEXT_PUBLIC_SHOP_WHATSAPP ?? "").replace(/\D/g, "");

export function SelectionBar() {
  const pathname = usePathname();
  const { items, remove, increment, decrement, clear } = useSelection();
  const [open, setOpen] = useState(false);

  const isStorefront = pathname === "/" || pathname.startsWith("/product/");
  if (!isStorefront || items.length === 0) return null;

  const share = () => {
    const message = buildWhatsAppMessage(items, window.location.origin);
    const base = SHOP_WA ? `https://wa.me/${SHOP_WA}` : "https://wa.me/";
    window.open(`${base}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-30 bg-ink text-paper px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
      {open && (
        <ul className="flex flex-col gap-1.5 mb-3 max-h-40 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate flex-1">{item.name}</span>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => decrement(item.id)}
                  disabled={item.quantity <= 1}
                  aria-label={`Decrease quantity of ${item.name}`}
                  className="p-2.5 disabled:opacity-30 opacity-70 hover:opacity-100"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="w-5 text-center tabular-nums" aria-live="polite">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => increment(item.id)}
                  aria-label={`Increase quantity of ${item.name}`}
                  className="p-2.5 opacity-70 hover:opacity-100"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => remove(item.id)}
                aria-label={`Remove ${item.name}`}
                className="p-2.5 opacity-70 hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-3 max-w-3xl mx-auto">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="min-h-11 text-sm font-medium underline underline-offset-2"
        >
          {items.length} selected
        </button>
        <button
          type="button"
          onClick={clear}
          className="min-h-11 text-sm opacity-70 hover:opacity-100"
        >
          Clear all
        </button>
        <button
          type="button"
          onClick={share}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-brass-deep px-4 h-11 text-sm font-medium dark:text-[#14130f]"
        >
          <MessageCircle className="size-4" />
          Share via WhatsApp
        </button>
      </div>
    </div>
  );
}
