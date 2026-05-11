import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { InitialsAvatar } from "@/components/initials-avatar";
import { ShareButtons } from "@/components/share-buttons";
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
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex items-center gap-1 text-sm text-zinc-500 flex-wrap">
            <li>
              <Link
                href="/"
                className="hover:text-zinc-800 hover:underline underline-offset-4"
              >
                Catalog
              </Link>
            </li>
            {category && (
              <>
                <li>
                  <ChevronRight className="size-3.5 text-zinc-400" />
                </li>
                <li>
                  <span>{category.name}</span>
                </li>
              </>
            )}
            <li>
              <ChevronRight className="size-3.5 text-zinc-400" />
            </li>
            <li
              aria-current="page"
              className="text-zinc-800 font-medium truncate max-w-[40ch]"
            >
              {p.name}
            </li>
          </ol>
        </nav>

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
              <InitialsAvatar name={p.name} />
            )}
          </div>

          <div className="flex flex-col gap-4">
            {category && (
              <p className="text-sm text-zinc-500 uppercase tracking-wide">
                {category.name}
              </p>
            )}
            <h1 className="text-3xl md:text-4xl font-[family-name:var(--font-display)] font-semibold leading-tight">
              {p.name}
            </h1>
            <p className="text-3xl font-bold tabular-nums">
              {formatINR(p.selling_price)}
            </p>
            <ShareButtons
              title={p.name}
              text={`${p.name} · ${formatINR(p.selling_price)}`}
            />
          </div>
        </div>
      </main>
    </>
  );
}
