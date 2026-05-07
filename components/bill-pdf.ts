import { jsPDF } from "jspdf";
import type { Sale, SaleItem } from "@/lib/schemas";
import { formatINRAscii } from "@/lib/money";

type Options = {
  shopName: string;
  gstNumber: string | null;
};

export function generateBillPdf(sale: Sale, items: SaleItem[], opts: Options) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 15;
  const left = 15;
  const right = 195;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(opts.shopName, left, y);
  y += 6;
  if (opts.gstNumber) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`GSTIN: ${opts.gstNumber}`, left, y);
    y += 5;
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Bill: ${sale.bill_number}`, left, y);
  doc.text(new Date(sale.created_at).toLocaleString("en-IN"), right, y, {
    align: "right",
  });
  y += 6;

  if (sale.customer_name || sale.customer_phone) {
    doc.text(
      [
        sale.customer_name ? `Customer: ${sale.customer_name}` : "",
        sale.customer_phone ? `Phone: ${sale.customer_phone}` : "",
      ]
        .filter(Boolean)
        .join("   "),
      left,
      y
    );
    y += 6;
  }

  doc.line(left, y, right, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text("Item", left, y);
  doc.text("Qty", 120, y, { align: "right" });
  doc.text("Price", 150, y, { align: "right" });
  doc.text("Total", right, y, { align: "right" });
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.line(left, y, right, y);
  y += 5;

  for (const item of items) {
    if (y > 270) {
      doc.addPage();
      y = 15;
    }
    doc.text(item.product_name.slice(0, 45), left, y);
    doc.text(String(item.quantity), 120, y, { align: "right" });
    doc.text(formatINRAscii(item.unit_sell_price), 150, y, { align: "right" });
    doc.text(formatINRAscii(item.line_total), right, y, { align: "right" });
    y += 6;
  }

  doc.line(left, y, right, y);
  y += 6;
  doc.text("Subtotal", 150, y, { align: "right" });
  doc.text(formatINRAscii(sale.subtotal), right, y, { align: "right" });
  y += 6;
  if (sale.discount_amount > 0) {
    doc.text(`Discount (${sale.discount_pct}%)`, 150, y, { align: "right" });
    doc.text(`- ${formatINRAscii(sale.discount_amount)}`, right, y, { align: "right" });
    y += 6;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Grand Total", 150, y, { align: "right" });
  doc.text(formatINRAscii(sale.total), right, y, { align: "right" });
  y += 10;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text("Thank you for shopping with us.", 105, y, { align: "center" });

  doc.save(`bill-${sale.bill_number}.pdf`);
}
