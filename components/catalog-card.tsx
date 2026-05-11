import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { InitialsAvatar } from "@/components/initials-avatar";
import { formatINR } from "@/lib/money";
import type { Product, Category } from "@/lib/schemas";

type Props = {
  product: Product;
  category?: Category;
};

export function CatalogCard({ product, category }: Props) {
  return (
    <Link href={`/product/${product.id}`} className="block">
      <Card className="transition-transform active:scale-[0.98] hover:shadow-md overflow-hidden">
        <div className="relative aspect-square bg-zinc-50 dark:bg-zinc-800 p-2">
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
        </div>
        <div className="p-3 flex flex-col gap-1">
          <h3 className="font-medium line-clamp-2 leading-tight">{product.name}</h3>
          {category && <p className="text-xs text-zinc-500 dark:text-zinc-400">{category.name}</p>}
          <p className="mt-1 text-lg font-semibold">{formatINR(product.selling_price)}</p>
        </div>
      </Card>
    </Link>
  );
}
