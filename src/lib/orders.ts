import { queueCallback, type QueueClient } from "./callbacks/queue";
import { formatLocalDay, parseLocalTime } from "./dates";
import type { Fault } from "./fault";
import { roundMoney } from "./money";
import { formatCount } from "./numbers";

/**
 * Charge for a service, in the panel's base currency.
 *
 * `decimals` is that currency's precision and has no default on purpose — see
 * roundMoney. Passing the display currency's instead would price an order in
 * one unit and round it in another.
 */
export function calculateCharge(ratePer1000: number, quantity: number, decimals: number): number {
  return roundMoney((ratePer1000 * quantity) / 1000, decimals);
}

/**
 * What an order costs the panel, recorded at the moment it is placed.
 *
 * Null where the panel has no cost to record — a service fulfilled by hand —
 * so the profit report can leave those out instead of counting them as pure
 * margin. Stored rather than derived because provider rates move, and the
 * scheduled sync now moves them without anyone typing.
 */
export function orderCost(providerRate: number, quantity: number, decimals: number): number | null {
  return providerRate > 0 ? roundMoney((providerRate * quantity) / 1000, decimals) : null;
}

/**
 * Orders the panel is still working on.
 *
 * Held is absent: nothing is being done with a held order until somebody
 * decides. Every count of "in flight" reads this rather than writing the list
 * out again, which is how `held` came to be missing from some of them.
 */
export const ACTIVE_ORDER_STATUSES = ["pending", "processing", "inprogress"];

/**
 * The same thing from the customer's side, where held reads as pending.
 *
 * Without this a customer with a held order sees it listed under "pending" in
 * their orders but not counted among their active ones — the panel visibly
 * disagreeing with itself about an order they can see.
 */
export const CUSTOMER_ACTIVE_STATUSES = [...ACTIVE_ORDER_STATUSES, "held"];

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
 * An order that is only a booking: scheduled for a time still ahead, still
 * pending, and never sent anywhere.
 *
 * The pages that offer a cancel button and the action that honours it read
 * the same function, so a button cannot appear for an order the action would
 * refuse — or fail to appear for one it would accept.
 */
export function notStartedYet(order: { status: string; startAt: Date | null; providerOrderId: string }): boolean {
  return order.status === "pending" && order.startAt !== null && order.startAt > new Date() && !order.providerOrderId;
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
  /**
   * Set when the posts are the ones already on the profile rather than the
   * ones still to come. Carried on the value so an order read back off a row
   * — a held order being released, a hop written to the panel above — stays
   * the kind of order it was without its re-sender having to look the service
   * up again.
   */
  spread?: boolean;
};

/**
 * An end date as the customer wrote it, into the day it names.
 *
 * Both shapes it arrives in are accepted: the dd/mm/yyyy the API standard
 * uses, and the yyyy-mm-dd a date input posts.
 *
 * Returned as both the instant to store — midnight in the panel's own zone,
 * so the stored moment shows the same day back to the reader — and the plain
 * "2026-08-20" string, which is what the comparison against today is made on.
 * Comparing strings avoids the question of what hour "today" starts at on a
 * server that is not in the panel's zone: it never starts one.
 */
function parseExpiry(raw: string, timeZone: string): { at: Date; day: string } | null {
  const slashed = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  const day = slashed
    ? `${slashed[3]}-${slashed[2].padStart(2, "0")}-${slashed[1].padStart(2, "0")}`
    : /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? raw
      : null;
  if (!day) return null;

  const at = parseLocalTime(`${day}T00:00`, timeZone);
  return at ? { at, day } : null;
}

/**
 * Whether a quantity sits on the service's step, and what to suggest if not.
 *
 * Some providers only take round hundreds, and an order for 1,050 comes back
 * refused after the customer has already been charged and has already been
 * told the order was placed. Checking it at the door costs nothing and turns
 * a refund into a corrected number.
 *
 * Answers with the nearest allowed quantity rather than only "no": the
 * customer wants a number they can use, and rounding down when that would
 * fall under the minimum is the one case where up is the only answer.
 */
export function checkIncrement(
  quantity: number,
  service: { min: number; max: number; increment: number },
): { suggestion: number } | null {
  const step = service.increment;
  if (!step || step <= 1) return null;
  if (quantity % step === 0) return null;

  const down = Math.floor(quantity / step) * step;
  const up = Math.ceil(quantity / step) * step;
  const suggestion = down >= service.min ? down : up;
  return { suggestion: Math.min(suggestion, Math.floor(service.max / step) * step) };
}

/**
 * The two service types addressed by a username over a run of posts.
 *
 * A subscription waits for posts that do not exist yet; a spread works
 * through the ones already on the profile. Everything between the order form
 * and the provider call is the same for both, so the check is one function
 * rather than two comparisons repeated in five files.
 */
export function isProfileOrder(type: string): boolean {
  return type === "subscription" || type === "spread";
}

/** The columns a subscription or spread order sets, or nulls when it is neither. */
export function subscriptionFields(sub: Subscription | null, spread = sub?.spread ?? false) {
  return {
    // The count lands in whichever column says what it counts. Keeping them
    // apart is what lets a row be read back correctly: `posts` alone would
    // leave a finished spread looking like a subscription still waiting for
    // the next post.
    posts: sub && !spread ? sub.posts : null,
    oldPosts: sub && spread ? sub.posts : null,
    minPerPost: sub?.minPerPost ?? null,
    maxPerPost: sub?.maxPerPost ?? null,
    // A spread has no future to wait for, so neither of these is offered on
    // its form and neither is stored.
    delay: sub && !spread ? sub.delay : null,
    expiry: sub && !spread ? sub.expiry : null,
  };
}

/**
 * The same columns read back off a stored order.
 *
 * One of the two counts is what makes an order one of these — the other
 * columns are null on ordinary orders too — so they are what the check hangs
 * on, and which of them is set is what tells the two kinds apart. Needed
 * wherever an order is re-sent from the row rather than from a form, which is
 * how a held order reaches its provider after approval.
 */
export function readSubscription(order: {
  link: string;
  posts: number | null;
  oldPosts?: number | null;
  minPerPost: number | null;
  maxPerPost: number | null;
  delay: number | null;
  expiry: Date | null;
}): Subscription | null {
  const count = order.posts ?? order.oldPosts ?? null;
  if (count === null) return null;
  return {
    // On either kind `link` holds the username being watched.
    username: order.link,
    posts: count,
    spread: order.posts === null,
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
 *
 * The refusals come back as keys rather than sentences. Written out here they
 * were English, and stayed English on a Vietnamese panel — the one form in
 * the order page that answered in the wrong language, because it was the one
 * whose checks live in a file shared with the API. The API turns them into
 * fixed English, the form into the reader's language, and neither has to
 * agree with the other about wording.
 */
export function parseSubscription(
  raw: { username: string; posts: string; min: string; max: string; delay: string; expiry: string },
  service: { min: number; max: number },
  /** The panel's zone, which is the one the end date is written in. */
  timeZone: string,
  /** Whose digit grouping the per-post limits are quoted in. */
  locale: string,
): { sub: Subscription; quantity: number } | { fieldErrors: Record<string, Fault> } {
  const fieldErrors: Record<string, Fault> = {};

  const username = raw.username.trim().replace(/^@/, "");
  if (!username) fieldErrors.username = { key: "err.subUsername" };
  else if (!/^[A-Za-z0-9._-]{1,64}$/.test(username)) fieldErrors.username = { key: "err.subUsernameShape" };

  const posts = Number(raw.posts);
  if (!Number.isInteger(posts) || posts < 1) fieldErrors.posts = { key: "err.subPosts" };

  const minPerPost = Number(raw.min);
  const maxPerPost = Number(raw.max);
  if (!Number.isInteger(minPerPost) || minPerPost < service.min) {
    fieldErrors.min = { key: "err.subMin", vars: { min: formatCount(service.min, locale) } };
  }
  if (!Number.isInteger(maxPerPost) || maxPerPost > service.max) {
    fieldErrors.max = { key: "err.subMax", vars: { max: formatCount(service.max, locale) } };
  }
  if (!fieldErrors.min && !fieldErrors.max && minPerPost > maxPerPost) {
    fieldErrors.max = { key: "err.subMaxBelowMin" };
  }

  const delay = Number(raw.delay || 0);
  if (!SUBSCRIPTION_DELAYS.includes(delay as (typeof SUBSCRIPTION_DELAYS)[number])) {
    fieldErrors.delay = { key: "err.subDelay", vars: { options: SUBSCRIPTION_DELAYS.join(", ") } };
  }

  // Optional, and only meaningful in the future — an expiry already past would
  // charge for a subscription that can never deliver.
  let expiry: Date | null = null;
  if (raw.expiry.trim()) {
    const parsed = parseExpiry(raw.expiry.trim(), timeZone);
    if (!parsed) fieldErrors.expiry = { key: "err.subExpiry" };
    // An expiry is a day, not a moment, so today itself is still a valid
    // answer at any hour of it — in the panel's zone, not the server's.
    else if (parsed.day < formatLocalDay(new Date(), timeZone)) {
      fieldErrors.expiry = { key: "err.subExpiryPast" };
    } else {
      expiry = parsed.at;
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
