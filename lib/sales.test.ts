import { describe, it, expect } from "vitest";
import { computeSubtotal, computeDiscountAmount, computeTotal, computeProfit } from "./sales";
import type { CartLine, SaleItem } from "./schemas";

const line = (overrides: Partial<CartLine> = {}): CartLine => ({
  product_id: "00000000-0000-0000-0000-000000000001",
  product_name: "Item",
  quantity: 1,
  unit_sell_price: 100,
  stock_at_add: 10,
  ...overrides,
});

describe("computeSubtotal", () => {
  it("returns 0 for empty cart", () => {
    expect(computeSubtotal([])).toBe(0);
  });
  it("sums quantity * unit_sell_price per line", () => {
    expect(
      computeSubtotal([
        line({ quantity: 2, unit_sell_price: 50 }),
        line({ quantity: 3, unit_sell_price: 10 }),
      ])
    ).toBe(130);
  });
});

describe("computeDiscountAmount", () => {
  it("returns 0 when discount_pct is 0", () => {
    expect(computeDiscountAmount(100, 0)).toBe(0);
  });
  it("rounds to 2 decimals", () => {
    expect(computeDiscountAmount(99.99, 10)).toBe(10.0);
    expect(computeDiscountAmount(33.33, 33)).toBe(11.0);
  });
  it("clamps discount_pct to [0, 100]", () => {
    expect(computeDiscountAmount(100, -5)).toBe(0);
    expect(computeDiscountAmount(100, 150)).toBe(100);
  });
});

describe("computeTotal", () => {
  it("is subtotal - discount_amount", () => {
    expect(computeTotal(100, 10)).toBe(90);
  });
  it("never negative", () => {
    expect(computeTotal(50, 100)).toBe(0);
  });
});

describe("computeProfit", () => {
  const saleItem = (overrides: Partial<SaleItem> = {}): SaleItem => ({
    id: "x",
    sale_id: "s",
    product_id: "p",
    product_name: "P",
    unit_bought_price: 40,
    unit_sell_price: 100,
    quantity: 1,
    line_total: 100,
    ...overrides,
  });
  it("sums (sell - bought) * quantity", () => {
    expect(
      computeProfit([
        saleItem({ quantity: 2 }),
        saleItem({ unit_bought_price: 50, unit_sell_price: 80, quantity: 3 }),
      ])
    ).toBe((100 - 40) * 2 + (80 - 50) * 3);
  });
  it("is 0 for empty", () => {
    expect(computeProfit([])).toBe(0);
  });
});
