import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { InitialsAvatar } from "@/components/initials-avatar";
import { SelectToggle } from "@/components/select-toggle";
import { formatINR } from "@/lib/money";
import { availability } from "@/lib/availability";
import type { Product, Category } from "@/lib/schemas";

type Props = {
  product: Product;
  category?: Category;
};

export function CatalogCard({ product, category }: Props) {
  const av = availability(product.stock, product.low_stock_threshold);
  // Only flag the urgency cases on cards — "in stock" needs no badge.
  const urgent = av.tone === "one" || av.tone === "low";

  return (
    <Link href={`/product/${product.id}`} className="block">
      <Card className="border-paper-edge bg-paper transition-transform active:scale-[0.98] hover:shadow-md overflow-hidden">
        <div className="relative aspect-square bg-paper-panel p-2">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, 33vw"
              className="object-contain"
            />
          ) : (
            <InitialsAvatar name={product.name} />
          )}
          {urgent && (
            <span className="absolute top-2 left-2 specimen-label text-brass bg-paper/90 backdrop-blur px-2 py-1 rounded">
              {av.label}
            </span>
          )}
          <div className="absolute top-2 right-2">
            <SelectToggle item={{ id: product.id, name: product.name, price: product.selling_price }} />
          </div>
        </div>
        <div className="p-3 flex flex-col gap-1.5">
          {category && (
            <p className="specimen-label text-mist truncate">{category.name}</p>
          )}
          <h3 className="font-[family-name:var(--font-display)] line-clamp-2 leading-tight text-ink">
            {product.name}
          </h3>
          <p className="mt-0.5 font-mono text-sm tabular-nums text-ink">
            {formatINR(product.selling_price)}
          </p>
        </div>
      </Card>
    </Link>
  );
}
