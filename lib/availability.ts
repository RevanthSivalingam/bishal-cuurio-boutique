export type AvailabilityTone = "in" | "low" | "one" | "out";

export type Availability = {
  label: string;
  tone: AvailabilityTone;
};

// Read-only presentation of the existing `stock` field — no business logic change.
// Curios are often singular, so stock === 1 gets its own "one of a kind" treatment.
export function availability(stock: number, lowThreshold = 5): Availability {
  if (stock <= 0) return { label: "Sold", tone: "out" };
  if (stock === 1) return { label: "One of a kind", tone: "one" };
  if (stock <= lowThreshold) return { label: `Only ${stock} left`, tone: "low" };
  return { label: "In stock", tone: "in" };
}
