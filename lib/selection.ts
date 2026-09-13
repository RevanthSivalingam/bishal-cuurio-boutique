import { z } from "zod";
import { formatINR } from "./money";

const STORAGE_KEY = "cuurio:selection";

export type SelectedItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

export type NewSelectedItem = Omit<SelectedItem, "quantity">;

const selectedItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  quantity: z.number().int().min(1),
});
const selectionSchema = z.array(selectedItemSchema);

export function readSelection(): SelectedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const result = selectionSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

export function writeSelection(items: SelectedItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage unavailable (private browsing, quota) — selection just won't persist.
  }
}

export function addItem(items: SelectedItem[], item: NewSelectedItem): SelectedItem[] {
  if (items.some((i) => i.id === item.id)) return items;
  return [...items, { ...item, quantity: 1 }];
}

export function removeItem(items: SelectedItem[], id: string): SelectedItem[] {
  return items.filter((i) => i.id !== id);
}

export function incrementQuantity(items: SelectedItem[], id: string): SelectedItem[] {
  return items.map((i) => (i.id === id ? { ...i, quantity: i.quantity + 1 } : i));
}

export function decrementQuantity(items: SelectedItem[], id: string): SelectedItem[] {
  return items.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i));
}

export function buildWhatsAppMessage(items: SelectedItem[], origin: string): string {
  const lines = items.map((item, i) => {
    const qtySuffix = item.quantity > 1 ? ` ×${item.quantity}` : "";
    const lineTotal = formatINR(item.price * item.quantity);
    return `${i + 1}. ${item.name}${qtySuffix} — ${lineTotal}\n${origin}/product/${item.id}`;
  });
  return `Hi! I'm interested in these:\n\n${lines.join("\n\n")}\n\n${items.length} item${
    items.length === 1 ? "" : "s"
  } total`;
}
