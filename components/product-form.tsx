"use client";

import { useState } from "react";
import { Percent, IndianRupee } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Trash2 } from "lucide-react";

import type { z } from "zod";
import { productSchema, type Category, type Product } from "@/lib/schemas";

type FormInput = z.input<typeof productSchema>;
type FormOutput = z.output<typeof productSchema>;
import { calcMargin, formatINR } from "@/lib/money";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImageUpload } from "@/components/image-upload";

type Props = {
  categories: Category[];
  initial?: Product;
};

export function ProductForm({ categories, initial }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(productSchema),
    defaultValues: initial
      ? {
          name: initial.name,
          category_id: initial.category_id,
          bought_price: initial.bought_price,
          selling_price: initial.selling_price,
          stock: initial.stock,
          low_stock_threshold: initial.low_stock_threshold,
          image_url: initial.image_url,
        }
      : {
          name: "",
          category_id: null,
          bought_price: 0,
          selling_price: 0,
          stock: 0,
          low_stock_threshold: 5,
          image_url: null,
        },
  });

  const bought = Number(useWatch({ control, name: "bought_price" })) || 0;
  const selling = Number(useWatch({ control, name: "selling_price" })) || 0;
  const imageUrl = useWatch({ control, name: "image_url" }) ?? null;
  const margin = calcMargin(selling, bought);

  const onSubmit = async (values: FormOutput) => {
    setServerError(null);
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setServerError("Not signed in");
      return;
    }

    const payload = {
      name: values.name,
      category_id: values.category_id || null,
      bought_price: values.bought_price,
      selling_price: values.selling_price,
      stock: values.stock,
      low_stock_threshold: values.low_stock_threshold,
      image_url: values.image_url || null,
      owner_id: user.id,
    };

    const { error } = initial
      ? await supabase.from("products").update(payload).eq("id", initial.id)
      : await supabase.from("products").insert(payload);

    if (error) {
      setServerError(error.message);
      return;
    }
    router.push("/inventory");
    router.refresh();
  };

  const onDelete = async () => {
    if (!initial) return;
    if (!confirm(`Delete "${initial.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("products").delete().eq("id", initial.id);
    setDeleting(false);
    if (error) {
      setServerError(error.message);
      return;
    }
    router.push("/inventory");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 pb-24">
      <Card className="p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Product name</Label>
          <Input id="name" placeholder="e.g. Ceramic Rose Plate" {...register("name")} />
          {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category_id">Category</Label>
          <Select id="category_id" {...register("category_id")} defaultValue={initial?.category_id ?? ""}>
            <option value="">— None —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Product photo</Label>
          <ImageUpload value={imageUrl} onChange={(url) => setValue("image_url", url)} />
        </div>
      </Card>

      <Card className="p-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bought_price">Bought price (₹)</Label>
            <Input
              id="bought_price"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              {...register("bought_price")}
            />
            {errors.bought_price && (
              <p className="text-sm text-red-600">{errors.bought_price.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="selling_price">Selling price (₹)</Label>
            <Input
              id="selling_price"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              {...register("selling_price")}
            />
            {errors.selling_price && (
              <p className="text-sm text-red-600">{errors.selling_price.message}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-zinc-50 border border-zinc-200 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Margin</p>
            <p className="text-lg font-semibold">{formatINR(margin.amount)}</p>
          </div>
          <Badge variant={margin.amount >= 0 ? "success" : "danger"}>
            {margin.pct.toFixed(1)}%
          </Badge>
        </div>

        <DiscountHelper
          selling={selling}
          onApply={(next) =>
            setValue("selling_price", Math.max(0, Math.round(next * 100) / 100), {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        />
      </Card>

      <Card className="p-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stock">Stock</Label>
            <Input
              id="stock"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              {...register("stock")}
            />
            {errors.stock && <p className="text-sm text-red-600">{errors.stock.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="low_stock_threshold">Low-stock alert</Label>
            <Input
              id="low_stock_threshold"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              {...register("low_stock_threshold")}
            />
          </div>
        </div>
      </Card>

      {serverError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{serverError}</p>
      )}

      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-zinc-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-5xl mx-auto flex gap-2">
          {initial && (
            <Button
              type="button"
              variant="outline"
              onClick={onDelete}
              disabled={deleting || isSubmitting}
              aria-label="Delete"
            >
              <Trash2 className="size-4 text-red-600" />
            </Button>
          )}
          <Button type="submit" className="flex-1" size="lg" disabled={isSubmitting || deleting}>
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : initial ? (
              "Save changes"
            ) : (
              "Add product"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

function DiscountHelper({
  selling,
  onApply,
}: {
  selling: number;
  onApply: (next: number) => void;
}) {
  const [pct, setPct] = useState("");
  const [amt, setAmt] = useState("");

  const applyPct = () => {
    const p = Number(pct);
    if (!p || isNaN(p)) return;
    onApply(selling * (1 - p / 100));
    setPct("");
  };
  const applyAmt = () => {
    const a = Number(amt);
    if (!a || isNaN(a)) return;
    onApply(selling - a);
    setAmt("");
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3">
      <p className="text-xs uppercase tracking-wide text-zinc-500">
        Quick discount on selling price
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1">
          <div className="relative flex-1">
            <Percent className="size-3 absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="10"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              className="pl-6"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), applyPct())}
            />
          </div>
          <Button type="button" size="sm" variant="outline" onClick={applyPct}>
            Apply %
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative flex-1">
            <IndianRupee className="size-3 absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              type="number"
              min="0"
              step="1"
              placeholder="50"
              value={amt}
              onChange={(e) => setAmt(e.target.value)}
              className="pl-6"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), applyAmt())}
            />
          </div>
          <Button type="button" size="sm" variant="outline" onClick={applyAmt}>
            Apply ₹
          </Button>
        </div>
      </div>
    </div>
  );
}
