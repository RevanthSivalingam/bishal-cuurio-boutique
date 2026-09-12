import { describe, it, expect, beforeEach } from "vitest";
import {
  addItem,
  removeItem,
  buildWhatsAppMessage,
  readSelection,
  writeSelection,
  type SelectedItem,
} from "./selection";

const vase: SelectedItem = { id: "1", name: "Brass Vase", price: 450 };
const lamp: SelectedItem = { id: "2", name: "Ceramic Lamp", price: 1200 };

describe("addItem", () => {
  it("adds a new item", () => {
    expect(addItem([], vase)).toEqual([vase]);
  });
  it("ignores a duplicate id", () => {
    expect(addItem([vase], { ...vase, name: "Different name" })).toEqual([vase]);
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

describe("buildWhatsAppMessage", () => {
  it("formats a single item", () => {
    const msg = buildWhatsAppMessage([vase], "https://shop.example");
    expect(msg).toBe(
      "Hi! I'm interested in these:\n\n1. Brass Vase — ₹450\nhttps://shop.example/product/1\n\n1 item total"
    );
  });
  it("numbers and joins multiple items", () => {
    const msg = buildWhatsAppMessage([vase, lamp], "https://shop.example");
    expect(msg).toContain("1. Brass Vase — ₹450");
    expect(msg).toContain("2. Ceramic Lamp — ₹1,200");
    expect(msg).toContain("2 items total");
  });
  it("preserves special characters verbatim — URL-encoding happens at the caller, not here", () => {
    const special: SelectedItem = { id: "3", name: 'Vase "Deluxe" & Co.', price: 100 };
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
});
