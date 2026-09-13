import { describe, it, expect, beforeEach } from "vitest";
import {
  addItem,
  removeItem,
  incrementQuantity,
  decrementQuantity,
  buildWhatsAppMessage,
  readSelection,
  writeSelection,
  type SelectedItem,
} from "./selection";

const vase: SelectedItem = { id: "1", name: "Brass Vase", price: 450, quantity: 1 };
const lamp: SelectedItem = { id: "2", name: "Ceramic Lamp", price: 1200, quantity: 1 };

describe("addItem", () => {
  it("adds a new item at quantity 1", () => {
    expect(addItem([], { id: "1", name: "Brass Vase", price: 450 })).toEqual([vase]);
  });
  it("ignores a duplicate id", () => {
    expect(addItem([vase], { id: "1", name: "Different name", price: 450 })).toEqual([vase]);
  });
});

describe("removeItem", () => {
  it("removes the matching item", () => {
    expect(removeItem([vase, lamp], "1")).toEqual([lamp]);
  });
  it("is a no-op when the id isn't present", () => {
    expect(removeItem([vase], "999")).toEqual([vase]);
  });
});

describe("incrementQuantity", () => {
  it("increases the matching item's quantity by 1", () => {
    expect(incrementQuantity([vase, lamp], "1")).toEqual([{ ...vase, quantity: 2 }, lamp]);
  });
  it("is a no-op when the id isn't present", () => {
    expect(incrementQuantity([vase], "999")).toEqual([vase]);
  });
});

describe("decrementQuantity", () => {
  it("decreases the matching item's quantity by 1", () => {
    const twoVases = { ...vase, quantity: 2 };
    expect(decrementQuantity([twoVases, lamp], "1")).toEqual([vase, lamp]);
  });
  it("floors at 1 — never goes to 0 or below", () => {
    expect(decrementQuantity([vase, lamp], "1")).toEqual([vase, lamp]);
  });
  it("is a no-op when the id isn't present", () => {
    expect(decrementQuantity([vase], "999")).toEqual([vase]);
  });
});

describe("buildWhatsAppMessage", () => {
  it("formats a single item at quantity 1 with no quantity suffix", () => {
    const msg = buildWhatsAppMessage([vase], "https://shop.example");
    expect(msg).toBe(
      "Hi! I'm interested in these:\n\n1. Brass Vase — ₹450\nhttps://shop.example/product/1\n\n1 item total"
    );
  });
  it("shows a ×N suffix and the line total when quantity is greater than 1", () => {
    const msg = buildWhatsAppMessage([{ ...vase, quantity: 2 }], "https://shop.example");
    expect(msg).toBe(
      "Hi! I'm interested in these:\n\n1. Brass Vase ×2 — ₹900\nhttps://shop.example/product/1\n\n1 item total"
    );
  });
  it("numbers and joins multiple items", () => {
    const msg = buildWhatsAppMessage([vase, lamp], "https://shop.example");
    expect(msg).toContain("1. Brass Vase — ₹450");
    expect(msg).toContain("2. Ceramic Lamp — ₹1,200");
    expect(msg).toContain("2 items total");
  });
  it("preserves special characters verbatim — URL-encoding happens at the caller, not here", () => {
    const special: SelectedItem = { id: "3", name: 'Vase "Deluxe" & Co.', price: 100, quantity: 1 };
    const msg = buildWhatsAppMessage([special], "https://shop.example");
    expect(msg).toContain('Vase "Deluxe" & Co.');
  });
});

describe("readSelection / writeSelection", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips items through localStorage", () => {
    writeSelection([vase, lamp]);
    expect(readSelection()).toEqual([vase, lamp]);
  });
  it("returns an empty array when nothing is stored", () => {
    expect(readSelection()).toEqual([]);
  });
  it("returns an empty array for corrupted JSON instead of throwing", () => {
    window.localStorage.setItem("cuurio:selection", "{not valid json");
    expect(readSelection()).toEqual([]);
  });
  it("returns an empty array for validly-parsed JSON with malformed elements (null)", () => {
    window.localStorage.setItem("cuurio:selection", "[null]");
    expect(readSelection()).toEqual([]);
  });
  it("returns an empty array for validly-parsed JSON with malformed elements (empty object)", () => {
    window.localStorage.setItem("cuurio:selection", "[{}]");
    expect(readSelection()).toEqual([]);
  });
  it("returns an empty array for items missing quantity (pre-quantity schema)", () => {
    window.localStorage.setItem(
      "cuurio:selection",
      JSON.stringify([{ id: "1", name: "Brass Vase", price: 450 }])
    );
    expect(readSelection()).toEqual([]);
  });
});
