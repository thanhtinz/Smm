/** Charge for a service, in the panel's base currency. */
export function calculateCharge(ratePer1000: number, quantity: number): number {
  return Math.round((ratePer1000 * quantity) / 1000);
}

/**
 * What an order costs the panel, recorded at the moment it is placed.
 *
 * Null where the panel has no cost to record — a service fulfilled by hand —
 * so the profit report can leave those out instead of counting them as pure
 * margin. Stored rather than derived because provider rates move, and the
 * scheduled sync now moves them without anyone typing.
 */
export function orderCost(providerRate: number, quantity: number): number | null {
  return providerRate > 0 ? Math.round((providerRate * quantity) / 1000) : null;
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

/** One comment per line, blank lines dropped. */
export function commentLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export type Subscription = {
  username: string;
  posts: number;
  minPerPost: number;
  maxPerPost: number;
  delay: number;
  expiry: Date | null;
};

/**
 * Accepts both dates a subscription can arrive as: the dd/mm/yyyy the API
 * standard uses, and the yyyy-mm-dd a date input posts. Read as local time so
 * the day the customer picked is the day that is stored.
 */
function parseExpiry(raw: string): Date | null {
  const parts = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  const date = parts
    ? new Date(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1]))
    : /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? new Date(`${raw}T00:00:00`)
      : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

/** The columns a subscription order sets, or nulls when it is not one. */
export function subscriptionFields(sub: Subscription | null) {
  return {
    posts: sub?.posts ?? null,
    minPerPost: sub?.minPerPost ?? null,
    maxPerPost: sub?.maxPerPost ?? null,
    delay: sub?.delay ?? null,
    expiry: sub?.expiry ?? null,
  };
}

/** Minutes a subscription may wait after a post appears, as every panel offers them. */
export const SUBSCRIPTION_DELAYS = [0, 5, 10, 15, 30, 60, 90] as const;

/**
 * Reads and checks the fields a subscription order takes.
 *
 * Shared by the order form and the API so the two cannot drift: the min and
 * max on the service are per post here, and the customer is charged for the
 * ceiling — posts x maxPerPost — because that is the most that can be
 * delivered. Anything not used comes back as a refund like any other order.
 */
export function parseSubscription(
  raw: { username: string; posts: string; min: string; max: string; delay: string; expiry: string },
  service: { min: number; max: number },
): { sub: Subscription; quantity: number } | { fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};

  const username = raw.username.trim().replace(/^@/, "");
  if (!username) fieldErrors.username = "Enter the username to watch";
  else if (!/^[A-Za-z0-9._-]{1,64}$/.test(username)) fieldErrors.username = "Enter the username on its own, not a link";

  const posts = Number(raw.posts);
  if (!Number.isInteger(posts) || posts < 1) fieldErrors.posts = "Enter how many future posts this covers";

  const minPerPost = Number(raw.min);
  const maxPerPost = Number(raw.max);
  if (!Number.isInteger(minPerPost) || minPerPost < service.min) {
    fieldErrors.min = `At least ${service.min.toLocaleString()} per post`;
  }
  if (!Number.isInteger(maxPerPost) || maxPerPost > service.max) {
    fieldErrors.max = `At most ${service.max.toLocaleString()} per post`;
  }
  if (!fieldErrors.min && !fieldErrors.max && minPerPost > maxPerPost) {
    fieldErrors.max = "The maximum cannot be below the minimum";
  }

  const delay = Number(raw.delay || 0);
  if (!SUBSCRIPTION_DELAYS.includes(delay as (typeof SUBSCRIPTION_DELAYS)[number])) {
    fieldErrors.delay = `Choose one of ${SUBSCRIPTION_DELAYS.join(", ")} minutes`;
  }

  // Optional, and only meaningful in the future — an expiry already past would
  // charge for a subscription that can never deliver.
  let expiry: Date | null = null;
  if (raw.expiry.trim()) {
    expiry = parseExpiry(raw.expiry.trim());
    if (!expiry) fieldErrors.expiry = "Enter a valid date";
    else {
      // Compared against the start of today: an expiry is a day, not a moment,
      // so today itself is still a valid answer at any hour.
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expiry < today) fieldErrors.expiry = "The end date is in the past";
    }
  }

  if (Object.keys(fieldErrors).length) return { fieldErrors };
  return { sub: { username, posts, minPerPost, maxPerPost, delay, expiry }, quantity: posts * maxPerPost };
}

/** Rejects links that are not plausibly a social media target. */
export function isValidOrderLink(link: string): boolean {
  try {
    const url = new URL(link);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
