"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Printer, Download, Copy } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchSale, voidSale } from "@/lib/sales";
import type { Sale, SaleItem } from "@/lib/schemas";
import { generateBillPdf } from "@/components/bill-pdf";
import { VoidDialog } from "@/components/void-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

  if (error)
    return (
      <p className="text-red-600 dark:text-red-400" role="alert">
        {error}
      </p>
    );
  if (!sale)
    return (
      <div className="max-w-2xl mx-auto flex flex-col gap-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );

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
        footerText:
          process.env.NEXT_PUBLIC_BILL_FOOTER ||
          "Thank you for shopping with us.",
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-3xl font-bold tracking-tight tabular-nums">
            {sale.bill_number}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {new Date(sale.occurred_at).toLocaleString("en-IN")}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {sale.channel === "offline" && (
            <span className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs font-semibold">
              OFFLINE
            </span>
          )}
          {sale.status === "void" && (
            <span className="px-2 py-1 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs font-semibold">
              VOID
            </span>
          )}
        </div>
      </div>

      {(sale.customer_name || sale.customer_phone) && (
        <section className="text-sm text-zinc-700 dark:text-zinc-300 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800">
          {sale.customer_name && <p>Customer: {sale.customer_name}</p>}
          {sale.customer_phone && <p>Phone: {sale.customer_phone}</p>}
        </section>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-zinc-200 dark:border-zinc-800">
            <th className="py-2">Item</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Price</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-b border-zinc-100 dark:border-zinc-800">
              <td className="py-2">{i.product_name}</td>
              <td className="py-2 text-right tabular-nums">{i.quantity}</td>
              <td className="py-2 text-right tabular-nums">
                {formatINR(i.unit_sell_price)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {formatINR(i.line_total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="flex flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatINR(sale.subtotal)}</span>
        </div>
        {sale.discount_amount > 0 && (
          <div className="flex justify-between">
            <span>Discount ({sale.discount_pct}%)</span>
            <span className="tabular-nums">
              - {formatINR(sale.discount_amount)}
            </span>
          </div>
        )}
        <div className="flex justify-between text-lg font-semibold border-t border-zinc-200 dark:border-zinc-800 pt-2">
          <span>Total</span>
          <span className="tabular-nums">{formatINR(sale.total)}</span>
        </div>
      </section>

      <div className="flex gap-2 flex-wrap no-print">
        <Button variant="brand" onClick={download} disabled={downloading}>
          <Download className="size-4" />
          {downloading ? "Generating..." : "Download PDF"}
        </Button>
        <Button
          variant="outline"
          onClick={() => window.print()}
          aria-label="Print bill"
        >
          <Printer className="size-4" />
          Print
        </Button>
        <Link href={`/sales/new?duplicate=${sale.id}`}>
          <Button variant="outline">
            <Copy className="size-4" />
            Duplicate
          </Button>
        </Link>
        <div className="flex-1" />
        {voidable && <VoidDialog onConfirm={doVoid} />}
      </div>
    </div>
  );
}
