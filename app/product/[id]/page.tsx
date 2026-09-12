import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { InitialsAvatar } from "@/components/initials-avatar";
import { ShareButtons } from "@/components/share-buttons";
import { EnquireButton } from "@/components/enquire-button";
import { SelectToggle } from "@/components/select-toggle";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatINR } from "@/lib/money";
import { availability } from "@/lib/availability";
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
  const priceLabel = formatINR(p.selling_price);
  const av = availability(p.stock, p.low_stock_threshold);
  const inStock = p.stock > 0;
  const dotClass =
    av.tone === "low"
      ? "bg-amber-500"
      : av.tone === "out"
        ? "bg-mist"
        : "bg-brass";
  const availClass =
    av.tone === "one"
      ? "text-brass"
      : av.tone === "low"
        ? "text-amber-700 dark:text-amber-300"
        : "text-mist";

  return (
    <>
      <TopNav />
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-6 bg-paper text-ink">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-1 text-sm text-mist flex-wrap">
            <li>
              <Link
                href="/"
                className="hover:text-ink hover:underline underline-offset-4 decoration-brass"
              >
                Catalog
              </Link>
            </li>
            {category && (
              <>
                <li>
                  <ChevronRight className="size-3.5 text-mist" />
                </li>
                <li>
                  <span>{category.name}</span>
                </li>
              </>
            )}
            <li>
              <ChevronRight className="size-3.5 text-mist" />
            </li>
            <li
              aria-current="page"
              className="text-ink font-medium truncate max-w-[40ch]"
            >
              {p.name}
            </li>
          </ol>
        </nav>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="relative aspect-square bg-paper-panel border border-paper-edge rounded-xl overflow-hidden p-4">
            {p.image_url ? (
              <Image
                src={p.image_url}
                alt={p.name}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-contain"
                priority
              />
            ) : (
              <InitialsAvatar name={p.name} />
            )}
          </div>

          <div className="flex flex-col gap-4">
            <p className="specimen-label text-mist">
              № {p.id.slice(0, 6)}
              {category && <span> · {category.name}</span>}
            </p>
            <h1 className="text-3xl md:text-4xl font-[family-name:var(--font-display)] leading-tight text-ink">
              {p.name}
            </h1>
            <p className={`inline-flex items-center gap-2 specimen-label ${availClass}`}>
              <span className={`size-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
              {av.label}
            </p>
            <p className="text-3xl font-[family-name:var(--font-display)] tabular-nums text-ink">
              {priceLabel}
            </p>
            <div className="flex flex-col gap-3 pt-1">
              <div className="flex items-center gap-3">
                <EnquireButton name={p.name} price={priceLabel} available={inStock} />
                <SelectToggle
                  item={{ id: p.id, name: p.name, price: p.selling_price }}
                  size="lg"
                />
              </div>
              <ShareButtons
                title={p.name}
                text={`${p.name} · ${priceLabel}`}
              />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
