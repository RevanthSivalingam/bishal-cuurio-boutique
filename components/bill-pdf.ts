import { jsPDF } from "jspdf";
import type { Sale, SaleItem } from "@/lib/schemas";
import { formatINR } from "@/lib/money";

type Options = {
  shopName: string;
  gstNumber: string | null;
  footerText?: string;
};

const FONT_URL = "/fonts/NotoSans-Regular.ttf";
const FONT_NAME = "NotoSans";
const LOGO_URL = "/branding/logo-pdf.png";
const LOGO_ASPECT = 300 / 350; // width / height of public/branding/logo-pdf.png

let cachedFontBase64: string | null = null;
let cachedLogoBase64: string | null = null;

export function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function loadFontBase64(): Promise<string> {
  if (cachedFontBase64) return cachedFontBase64;
  const res = await fetch(FONT_URL);
  if (!res.ok) throw new Error(`Failed to load PDF font: ${res.status}`);
  cachedFontBase64 = bufferToBase64(await res.arrayBuffer());
  return cachedFontBase64;
}

export async function loadLogoBase64(): Promise<string> {
  if (cachedLogoBase64) return cachedLogoBase64;
  const res = await fetch(LOGO_URL);
  if (!res.ok) throw new Error(`Failed to load PDF logo: ${res.status}`);
  cachedLogoBase64 = bufferToBase64(await res.arrayBuffer());
  return cachedLogoBase64;
}

export async function generateBillPdf(
  sale: Sale,
  items: SaleItem[],
  opts: Options
) {
  const [fontBase64, logoBase64] = await Promise.all([
    loadFontBase64(),
    // A missing/broken logo must never block generating a bill — a core,
    // revenue-critical operation — so this failure is swallowed, not thrown.
    loadLogoBase64().catch(() => null),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.addFileToVFS(`${FONT_NAME}.ttf`, fontBase64);
  doc.addFont(`${FONT_NAME}.ttf`, FONT_NAME, "normal");

  const left = 15;
  const right = 195;
  let y = 15;

  if (logoBase64) {
    const logoWidth = 20;
    const logoHeight = logoWidth / LOGO_ASPECT;
    doc.addImage(
      `data:image/png;base64,${logoBase64}`,
      "PNG",
      105 - logoWidth / 2,
      8,
      logoWidth,
      logoHeight
    );
    y = 8 + logoHeight + 6;
  }

  doc.setFont(FONT_NAME, "normal");
  doc.setFontSize(18);
  doc.text(opts.shopName, 105, y, { align: "center" });
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
  doc.text(opts.footerText ?? "Thank you for shopping with us.", 105, y, {
    align: "center",
  });

  doc.save(`bill-${sale.bill_number}.pdf`);
}
