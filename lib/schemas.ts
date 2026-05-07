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
