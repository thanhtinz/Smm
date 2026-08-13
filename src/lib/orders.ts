/** Charge for a service, in the panel's base currency. */
export function calculateCharge(ratePer1000: number, quantity: number): number {
  return Math.round((ratePer1000 * quantity) / 1000);
}

export const ACTIVE_ORDER_STATUSES = ["pending", "processing", "inprogress"] as const;

export const ORDER_STATUSES = [
  "pending",
  "processing",
  "inprogress",
  "completed",
  "partial",
  "canceled",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Rejects links that are not plausibly a social media target. */
export function isValidOrderLink(link: string): boolean {
  try {
    const url = new URL(link);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
