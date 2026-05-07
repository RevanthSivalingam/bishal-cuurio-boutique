import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageOff, ArrowLeft } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatINR } from "@/lib/money";
import type { Category, Product } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!product) notFound();

  let category: Category | null = null;
  if (product.category_id) {
    const { data } = await supabase
      .from("categories")
      .select("id,name")
      .eq("id", product.category_id)
      .maybeSingle();
    category = (data as Category | null) ?? null;
  }

  const p = product as Product;

  return (
    <>
      <TopNav />
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-zinc-600 mb-4"
        >
          <ArrowLeft className="size-4" />
          Back to catalog
        </Link>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="relative aspect-square bg-zinc-100 rounded-xl overflow-hidden">
            {p.image_url ? (
              <Image
                src={p.image_url}
                alt={p.name}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
                priority
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-zinc-300">
                <ImageOff className="size-16" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <h1 className="text-2xl font-semibold">{p.name}</h1>
            {category && (
              <p className="text-sm text-zinc-500">{category.name}</p>
            )}
            <p className="text-3xl font-bold">{formatINR(p.selling_price)}</p>
          </div>
        </div>
      </main>
    </>
  );
}
