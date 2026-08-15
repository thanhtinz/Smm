import { queueCallback, type QueueClient } from "./callbacks";

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

/** Statuses an order does not move on from. */
export const SETTLED_ORDER_STATUSES = ["completed", "partial", "canceled", "refunded"] as const;

/**
 * Stamps settledAt when this write is the one that finishes an order.
 *
 * Every place that sets a final status goes through here, so "how long did
 * this take" has one answer rather than being inferred from updatedAt, which
 * moves whenever anything at all touches the row.
 */
export function withSettled<T extends Record<string, unknown>>(data: T): T {
  const status = data.status;
  if (typeof status === "string" && SETTLED_ORDER_STATUSES.includes(status as never)) {
    return { ...data, settledAt: new Date() };
  }
  return data;
}

export const ORDER_STATUSES = [
  // Paid for, but stopped by an abuse rule before it could be sent. Not an
  // active status: nothing dispatches it until a human says so.
  "held",
  "pending",
  "processing",
  "inprogress",
  "completed",
  "partial",
  "canceled",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * The statuses a customer is offered as filters — everything but `held`.
 *
 * Being under review is not something the panel tells the person it is
 * reviewing: it would name the rule they tripped, which is a map for anyone
 * working out how to get around it, and it would accuse the far larger number
 * of honest customers who trip these rules by accident.
 */
export const CUSTOMER_ORDER_STATUSES = ORDER_STATUSES.filter((s) => s !== "held");

/**
 * The title-case names the API standard uses.
 *
 * Shared by the `status` action and the callback body so a reseller can
 * switch on one string in both places. Held is reported as Pending: the
 * standard has no word for it, a reseller can do nothing about it, and
 * inventing one would break client code that switches on this.
 */
const API_STATUS: Record<string, string> = {
  held: "Pending",
  pending: "Pending",
  processing: "Processing",
  inprogress: "In progress",
  completed: "Completed",
  partial: "Partial",
  canceled: "Canceled",
  refunded: "Refunded",
};

export function apiStatus(status: string): string {
  return API_STATUS[status] ?? status;
}

/** A held order reads as pending to whoever placed it. */
export function customerStatus(status: string): string {
  return status === "held" ? "pending" : status;
}

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

/**
 * The same columns read back off a stored order.
 *
 * `posts` is what makes an order a subscription — the other columns are null
 * on ordinary orders too — so it is the one the check hangs on. Needed
 * wherever an order is re-sent from the row rather than from a form, which is
 * how a held order reaches its provider after approval.
 */
export function readSubscription(order: {
  link: string;
  posts: number | null;
  minPerPost: number | null;
  maxPerPost: number | null;
  delay: number | null;
  expiry: Date | null;
}): Subscription | null {
  if (order.posts === null) return null;
  return {
    // On a subscription order `link` holds the username being watched.
    username: order.link,
    posts: order.posts,
    minPerPost: order.minPerPost ?? 0,
    maxPerPost: order.maxPerPost ?? 0,
    delay: order.delay ?? 0,
    expiry: order.expiry,
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

/**
 * The client this can be written through: the panel-scoped one, or a
 * transaction handle from inside `$transaction`.
 */
type StepRow = {
  panelId: string;
  orderId: string;
  from: string;
  to: string;
  startCount: number;
  remains: number;
  actor: string;
  note: string;
};

type EventClient = {
  orderEvent: { create: (args: { data: StepRow }) => Promise<unknown> };
} & QueueClient;

/**
 * Records a step in an order's life.
 *
 * Called from every place that decides a status — seven of them, listed in
 * the test that walks an order through each one. It records rather than
 * updates, because the callers differ too much to share an update: some are
 * inside a transaction, one hands its data to `settleRefund` to apply.
 *
 * Writing nothing when the status did not move is deliberate. A sync tick
 * that only refreshes `remains` is not a step in the story, and a timeline
 * of two hundred identical rows tells support less than one of four.
 */
export async function recordOrderStep(
  client: EventClient,
  before: {
    id: string;
    panelId: string;
    publicId: number;
    userId: string;
    charge: number;
    status: string;
    startCount: number;
    remains: number;
  },
  next: { status?: unknown; startCount?: unknown; remains?: unknown; note?: unknown },
  actor: string,
): Promise<void> {
  const to = typeof next.status === "string" ? next.status : before.status;
  if (to === before.status) return;

  const startCount = typeof next.startCount === "number" ? next.startCount : before.startCount;
  const remains = typeof next.remains === "number" ? next.remains : before.remains;

  await client.orderEvent.create({
    data: {
      panelId: before.panelId,
      orderId: before.id,
      from: before.status,
      to,
      // The counts as they stand after this step, falling back to what the
      // order already held when this step did not touch them.
      startCount,
      remains,
      actor,
      note: typeof next.note === "string" ? next.note : "",
    },
  });

  // The same choke point, for the same reason: every status decision passes
  // through here, so a reseller cannot be told about five of the six.
  await queueCallback(client, before, { status: to, startCount, remains });
}
