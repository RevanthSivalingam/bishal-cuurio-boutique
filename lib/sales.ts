import type { SupabaseClient } from "@supabase/supabase-js";
import type { CartLine, CreateSaleInput, Sale, SaleItem } from "./schemas";

export const computeSubtotal = (lines: CartLine[]): number =>
  lines.reduce((sum, l) => sum + l.quantity * l.unit_sell_price, 0);

export const computeDiscountAmount = (subtotal: number, discountPct: number): number => {
  const clamped = Math.min(100, Math.max(0, discountPct));
  return Math.round(subtotal * clamped) / 100;
};

export const computeTotal = (subtotal: number, discountAmount: number): number =>
  Math.max(0, subtotal - discountAmount);

export const computeProfit = (items: SaleItem[]): number =>
  items.reduce((sum, i) => sum + (i.unit_sell_price - i.unit_bought_price) * i.quantity, 0);

export async function createSale(supabase: SupabaseClient, input: CreateSaleInput): Promise<Sale> {
  const { data, error } = await supabase.rpc("create_sale", {
    p_items: input.items.map((l) => ({
      product_id: l.product_id,
      quantity: l.quantity,
      unit_sell_price: l.unit_sell_price,
    })),
    p_discount_pct: input.discount_pct,
    p_customer_name: input.customer_name?.trim() || null,
    p_customer_phone: input.customer_phone?.trim() || null,
    p_occurred_at: input.occurred_at || null,
    p_channel: input.channel,
  });
  if (error) throw new Error(error.message);
  return data as Sale;
}

export async function voidSale(supabase: SupabaseClient, saleId: string): Promise<Sale> {
  const { data, error } = await supabase.rpc("void_sale", { p_sale_id: saleId });
  if (error) throw new Error(error.message);
  return data as Sale;
}

export async function fetchSale(supabase: SupabaseClient, saleId: string) {
  const { data: sale, error: saleErr } = await supabase
    .from("sales")
    .select("*")
    .eq("id", saleId)
    .single();
  if (saleErr) throw new Error(saleErr.message);
  const { data: items, error: itemsErr } = await supabase
    .from("sale_items")
    .select("*")
    .eq("sale_id", saleId)
    .order("id");
  if (itemsErr) throw new Error(itemsErr.message);
  return { sale: sale as Sale, items: (items ?? []) as SaleItem[] };
}

export async function listSales(
  supabase: SupabaseClient,
  from: string,
  to: string,
  status?: "active" | "void"
) {
  let q = supabase
    .from("sales")
    .select("*")
    .gte("occurred_at", from)
    .lte("occurred_at", to)
    .order("occurred_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Sale[];
}

export async function adjustStock(
  supabase: SupabaseClient,
  entries: Array<{
    product_id: string;
    mode: "set" | "adjust";
    value: number;
    reason?: string | null;
  }>
): Promise<number> {
  const { data, error } = await supabase.rpc("adjust_stock", {
    p_items: entries,
  });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

export async function fetchReportData(supabase: SupabaseClient, from: string, to: string) {
  const { data: sales, error: salesErr } = await supabase
    .from("sales")
    .select("*")
    .eq("status", "active")
    .gte("occurred_at", from)
    .lte("occurred_at", to);
  if (salesErr) throw new Error(salesErr.message);

  const saleIds = (sales ?? []).map((s) => s.id);
  if (saleIds.length === 0) return { sales: [] as Sale[], items: [] as SaleItem[] };

  const { data: items, error: itemsErr } = await supabase
    .from("sale_items")
    .select("*")
    .in("sale_id", saleIds);
  if (itemsErr) throw new Error(itemsErr.message);
  return { sales: (sales ?? []) as Sale[], items: (items ?? []) as SaleItem[] };
}
