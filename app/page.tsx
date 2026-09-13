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

  const shopName = process.env.NEXT_PUBLIC_SHOP_NAME || "The Boutique";

  return (
    <>
      <TopNav />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 pt-6 pb-24 bg-paper text-ink">
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-2 border-b border-paper-edge pb-5">
            <p className="specimen-label text-brass">Curios &amp; collectibles</p>
            <h1 className="text-3xl md:text-4xl font-[family-name:var(--font-display)] leading-tight text-ink">
              {shopName}
            </h1>
            <p className="text-sm text-mist max-w-prose">
              A rotating shelf of one-of-a-kind finds. Spot something you like,
              then message us to make it yours.
            </p>
          </header>
          <CatalogGrid
            products={(products ?? []) as Product[]}
            categories={(categories ?? []) as Category[]}
          />
        </div>
      </main>
    </>
  );
}
