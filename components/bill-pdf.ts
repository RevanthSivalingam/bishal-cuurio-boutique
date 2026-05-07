import { jsPDF } from "jspdf";
import type { Sale, SaleItem } from "@/lib/schemas";
import { formatINR } from "@/lib/money";

type Options = {
  shopName: string;
  gstNumber: string | null;
};

const FONT_URL = "/fonts/NotoSans-Regular.ttf";
const FONT_NAME = "NotoSans";
let cachedFontBase64: string | null = null;

async function loadFontBase64(): Promise<string> {
  if (cachedFontBase64) return cachedFontBase64;
  const res = await fetch(FONT_URL);
  if (!res.ok) throw new Error(`Failed to load PDF font: ${res.status}`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  cachedFontBase64 = btoa(binary);
  return cachedFontBase64;
}

export async function generateBillPdf(
  sale: Sale,
  items: SaleItem[],
  opts: Options
) {
  const fontBase64 = await loadFontBase64();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.addFileToVFS(`${FONT_NAME}.ttf`, fontBase64);
  doc.addFont(`${FONT_NAME}.ttf`, FONT_NAME, "normal");

  let y = 15;
  const left = 15;
  const right = 195;

  doc.setFont(FONT_NAME, "normal");
  doc.setFontSize(18);
  doc.text(opts.shopName, left, y);
  y += 6;
  if (opts.gstNumber) {
    doc.setFontSize(9);
    doc.text(`GSTIN: ${opts.gstNumber}`, left, y);
    y += 5;
  }

  doc.setFontSize(10);
  doc.text(`Bill: ${sale.bill_number}`, left, y);
  doc.text(new Date(sale.occurred_at).toLocaleString("en-IN"), right, y, {
    align: "right",
  });
  y += 6;
  if (sale.channel === "offline") {
    doc.setFontSize(9);
    doc.text("Offline sale", left, y);
    y += 5;
    doc.setFontSize(10);
  }

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
  doc.text("Item", left, y);
  doc.text("Qty", 120, y, { align: "right" });
  doc.text("Price", 150, y, { align: "right" });
  doc.text("Total", right, y, { align: "right" });
  y += 4;
  doc.line(left, y, right, y);
  y += 5;

  for (const item of items) {
    if (y > 270) {
      doc.addPage();
      y = 15;
    }
    doc.text(item.product_name.slice(0, 45), left, y);
    doc.text(String(item.quantity), 120, y, { align: "right" });
    doc.text(formatINR(item.unit_sell_price), 150, y, { align: "right" });
    doc.text(formatINR(item.line_total), right, y, { align: "right" });
    y += 6;
  }

  doc.line(left, y, right, y);
  y += 6;
  doc.text("Subtotal", 150, y, { align: "right" });
  doc.text(formatINR(sale.subtotal), right, y, { align: "right" });
  y += 6;
  if (sale.discount_amount > 0) {
    doc.text(`Discount (${sale.discount_pct}%)`, 150, y, { align: "right" });
    doc.text(`- ${formatINR(sale.discount_amount)}`, right, y, {
      align: "right",
    });
    y += 6;
  }
  doc.setFontSize(12);
  doc.text("Grand Total", 150, y, { align: "right" });
  doc.text(formatINR(sale.total), right, y, { align: "right" });
  y += 10;

  doc.setFontSize(9);
  doc.text("Thank you for shopping with us.", 105, y, { align: "center" });

  doc.save(`bill-${sale.bill_number}.pdf`);
}
