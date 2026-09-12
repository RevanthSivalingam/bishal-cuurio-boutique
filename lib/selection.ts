import { formatINR } from "./money";

const STORAGE_KEY = "cuurio:selection";

export type SelectedItem = {
  id: string;
  name: string;
  price: number;
};

export function readSelection(): SelectedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
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

export function addItem(items: SelectedItem[], item: SelectedItem): SelectedItem[] {
  if (items.some((i) => i.id === item.id)) return items;
  return [...items, item];
}

export function removeItem(items: SelectedItem[], id: string): SelectedItem[] {
  return items.filter((i) => i.id !== id);
}

export function buildWhatsAppMessage(items: SelectedItem[], origin: string): string {
  const lines = items.map(
    (item, i) => `${i + 1}. ${item.name} — ${formatINR(item.price)}\n${origin}/product/${item.id}`
  );
  return `Hi! I'm interested in these:\n\n${lines.join("\n\n")}\n\n${items.length} item${
    items.length === 1 ? "" : "s"
  } total`;
}
