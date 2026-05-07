import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/product-form";
import type { Category } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const supabase = await createSupabaseServerClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id,name")
    .order("name");

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
        <h1 className="text-2xl font-semibold tracking-tight">Add product</h1>
      </div>
      <ProductForm categories={(categories ?? []) as Category[]} />
    </div>
  );
}
