import Link from "next/link";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/money";
import type { Product, Category } from "@/lib/schemas";

type Props = {
  product: Product;
  category?: Category;
};

export function ProductCard({ product, category }: Props) {
  const low = product.stock <= product.low_stock_threshold;
  const out = product.stock === 0;

  return (
    <Link href={`/inventory/${product.id}/edit`} className="block">
      <Card className="transition-transform active:scale-[0.98] hover:shadow-md">
        <div className="relative aspect-square bg-zinc-50 p-2">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, 33vw"
              className="object-contain"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-300">
              <ImageOff className="size-10" />
            </div>
          )}
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
            {out ? (
              <Badge variant="danger">Out of stock</Badge>
            ) : low ? (
              <Badge variant="warning">Low · {product.stock}</Badge>
            ) : (
              <Badge variant="neutral">{product.stock} in stock</Badge>
            )}
          </div>
        </div>
        <div className="p-3 flex flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium line-clamp-2 leading-tight">{product.name}</h3>
          </div>
          {category && (
            <p className="text-xs text-zinc-500">{category.name}</p>
          )}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-lg font-semibold">{formatINR(product.selling_price)}</span>
            <Badge variant={product.margin >= 0 ? "success" : "danger"}>
              +{formatINR(product.margin)} · {Math.round(Number(product.margin_pct))}%
            </Badge>
          </div>
        </div>
      </Card>
    </Link>
  );
}
