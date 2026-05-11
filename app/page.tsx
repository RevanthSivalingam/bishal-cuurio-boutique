import { TopNav } from "@/components/top-nav";
import { CatalogGrid } from "@/components/catalog-grid";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Category, Product } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const supabase = await createSupabaseServerClient();
  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .gt("stock", 0)
      .order("created_at", { ascending: false }),
    supabase.from("categories").select("id,name").order("name"),
  ]);

  return (
    <>
      <TopNav />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-4">
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl md:text-4xl font-[family-name:var(--font-display)] font-semibold tracking-tight">
            Catalog
          </h1>
          <CatalogGrid
            products={(products ?? []) as Product[]}
            categories={(categories ?? []) as Category[]}
          />
        </div>
      </main>
    </>
  );
}
