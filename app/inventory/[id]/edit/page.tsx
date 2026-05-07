import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/product-form";
import type { Category, Product } from "@/lib/schemas";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function EditProductPage({ params }: Params) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const [{ data: product }, { data: categories }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("id,name").order("name"),
  ]);

  if (!product) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link
          href="/inventory"
          className="p-2 -ml-2 rounded-md hover:bg-zinc-100"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Edit product</h1>
      </div>
      <ProductForm
        categories={(categories ?? []) as Category[]}
        initial={product as Product}
      />
    </div>
  );
}
