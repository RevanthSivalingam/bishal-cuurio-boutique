import Link from "next/link";
import { Plus } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { InventoryGrid } from "./inventory-grid";
import type { Category, Product } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from("products").select("*").order("created_at", { ascending: false }),
    supabase.from("categories").select("id,name").order("name"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <Link href="/inventory/new">
          <Button size="md">
            <Plus className="size-4" />
            Add
          </Button>
        </Link>
      </div>

      <InventoryGrid
        products={(products ?? []) as Product[]}
        categories={(categories ?? []) as Category[]}
      />
    </div>
  );
}
