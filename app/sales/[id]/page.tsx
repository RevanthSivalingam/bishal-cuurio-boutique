"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchSale, voidSale } from "@/lib/sales";
import type { Sale, SaleItem } from "@/lib/schemas";
import { generateBillPdf } from "@/components/bill-pdf";
import { VoidDialog } from "@/components/void-dialog";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/money";

const VOID_WINDOW_MS = 24 * 60 * 60 * 1000;

export default function BillPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [sale, setSale] = useState<Sale | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    fetchSale(supabase, id)
      .then(({ sale, items }) => {
        setSale(sale);
        setItems(items);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [id]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!sale) return <p>Loading...</p>;

  const voidable =
    sale.status === "active" &&
    // eslint-disable-next-line react-hooks/purity
    Date.now() - new Date(sale.created_at).getTime() < VOID_WINDOW_MS;

  const download = async () => {
    setDownloading(true);
    try {
      await generateBillPdf(sale, items, {
        shopName: process.env.NEXT_PUBLIC_SHOP_NAME || "Boutique",
        gstNumber: process.env.NEXT_PUBLIC_GST_NUMBER || null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF failed");
    } finally {
      setDownloading(false);
    }
  };

  const doVoid = async () => {
    const supabase = createSupabaseBrowserClient();
    const updated = await voidSale(supabase, sale.id);
    setSale(updated);
    router.refresh();
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{sale.bill_number}</h1>
          <p className="text-sm text-zinc-500">
            {new Date(sale.created_at).toLocaleString("en-IN")}
          </p>
        </div>
        {sale.status === "void" && (
          <span className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-semibold">
            VOID
          </span>
        )}
      </div>

      {(sale.customer_name || sale.customer_phone) && (
        <section className="text-sm text-zinc-700">
          {sale.customer_name && <p>Customer: {sale.customer_name}</p>}
          {sale.customer_phone && <p>Phone: {sale.customer_phone}</p>}
        </section>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-zinc-200">
            <th className="py-1">Item</th>
            <th className="py-1 text-right">Qty</th>
            <th className="py-1 text-right">Price</th>
            <th className="py-1 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-b border-zinc-100">
              <td className="py-1">{i.product_name}</td>
              <td className="py-1 text-right">{i.quantity}</td>
              <td className="py-1 text-right">{formatINR(i.unit_sell_price)}</td>
              <td className="py-1 text-right">{formatINR(i.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="flex flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatINR(sale.subtotal)}</span>
        </div>
        {sale.discount_amount > 0 && (
          <div className="flex justify-between">
            <span>Discount ({sale.discount_pct}%)</span>
            <span>- {formatINR(sale.discount_amount)}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-semibold border-t border-zinc-200 pt-2">
          <span>Total</span>
          <span>{formatINR(sale.total)}</span>
        </div>
      </section>

      <div className="flex gap-2 flex-wrap">
        <Button onClick={download} disabled={downloading}>
          {downloading ? "Generating..." : "Download PDF"}
        </Button>
        {voidable && <VoidDialog onConfirm={doVoid} />}
      </div>
    </div>
  );
}
