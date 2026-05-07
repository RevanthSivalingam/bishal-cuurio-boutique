import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  category_id: z.string().uuid().nullable().optional(),
  bought_price: z.coerce.number().min(0, "Must be ≥ 0"),
  selling_price: z.coerce.number().min(0, "Must be ≥ 0"),
  stock: z.coerce.number().int().min(0, "Must be ≥ 0"),
  low_stock_threshold: z.coerce.number().int().min(0).default(5),
  image_url: z.string().url().nullable().optional(),
});

export type ProductInput = z.infer<typeof productSchema>;

export type Category = {
  id: string;
  name: string;
};

export type Product = {
  id: string;
  name: string;
  category_id: string | null;
  bought_price: number;
  selling_price: number;
  stock: number;
  image_url: string | null;
  low_stock_threshold: number;
  margin: number;
  margin_pct: number;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

export const cartLineSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string().min(1),
  quantity: z.coerce.number().int().min(1),
  unit_sell_price: z.coerce.number().min(0),
  stock_at_add: z.coerce.number().int().min(0),
});
export type CartLine = z.infer<typeof cartLineSchema>;

export const createSaleInputSchema = z.object({
  items: z.array(cartLineSchema).min(1, "Add at least one item"),
  discount_pct: z.coerce.number().min(0).max(100).default(0),
  customer_name: z.string().trim().max(80).optional().or(z.literal("")),
  customer_phone: z.string().trim().max(20).optional().or(z.literal("")),
});
export type CreateSaleInput = z.infer<typeof createSaleInputSchema>;

export type Sale = {
  id: string;
  owner_id: string;
  bill_number: string;
  subtotal: number;
  discount_pct: number;
  discount_amount: number;
  total: number;
  customer_name: string | null;
  customer_phone: string | null;
  status: "active" | "void";
  created_at: string;
  voided_at: string | null;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string;
  unit_bought_price: number;
  unit_sell_price: number;
  quantity: number;
  line_total: number;
};

export const stockAdjustmentEntrySchema = z.object({
  product_id: z.string().uuid(),
  mode: z.enum(["set", "adjust"]),
  value: z.coerce.number().int(),
  reason: z.string().trim().max(120).optional(),
});
export type StockAdjustmentEntry = z.infer<typeof stockAdjustmentEntrySchema>;

export type StockAdjustment = {
  id: string;
  owner_id: string;
  product_id: string;
  old_stock: number;
  new_stock: number;
  delta: number;
  mode: "set" | "adjust";
  reason: string | null;
  created_at: string;
};
