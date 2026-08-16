import { formatMoney, getBaseCurrency } from "@/lib/currency";
import { db } from "./db";
import { getSetting } from "./settings";
import { englishMessage, type Fault } from "./fault";

/**
 * What stands between an account and a runaway order loop.
 *
 * Counted from the Order table rather than from memory, so the checks hold
 * across a restart and mean the same thing whether the order came from the
 * form, the API or a mass paste — three doors into the same room.
 *
 * Two of these refuse and three hold. A refusal is for something the customer
 * can see and fix in a second: they double-clicked, they are going too fast,
 * or the operator has explicitly banned this link. A hold is for a *suspicion*
 * — evidence that points at abuse but fits an honest customer too — and it is
 * never an auto-cancel, because turning away a real customer costs more than
 * one fraudulent order does.
 */

/** Orders that were paid for. A refunded one should not block a retry. */
const COUNTED_STATUSES = ["held", "pending", "processing", "inprogress", "completed", "partial"];

export type GuardResult = Fault | null;

/**
 * Refuse outright, hold for a human, or let it through.
 *
 * `hold` is written onto the order in English rather than the buyer's
 * language: it is read by whoever is on the review queue, not by them.
 */
export type GuardVerdict = { block: Fault } | { hold: string } | null;

/**
 * The same service on the same link, again, within the window.
 *
 * Almost always a double-click or a client library retrying, and the customer
 * would be charged twice for one delivery. Zero switches it off, for panels
 * whose customers legitimately re-order the same link.
 */
export async function duplicateOrder(userId: string, serviceId: string, link: string): Promise<GuardResult> {
  const window = await duplicateWindow();
  if (!window) return null;

  const recent = await findDuplicate(db, userId, serviceId, link, window.since);
  if (!recent) return null;

  return { key: "err.duplicateOrder", vars: { id: recent.publicId, minutes: window.minutes } };
}

/** The configured window, or null when duplicate checking is switched off. */
export async function duplicateWindow(): Promise<{ minutes: number; since: Date } | null> {
  const minutes = Number(await getSetting("order.duplicateWindowMinutes")) || 0;
  if (minutes <= 0) return null;
  return { minutes, since: new Date(Date.now() - minutes * 60_000) };
}

/** Narrow enough that a `$transaction` handle satisfies it. */
type OrderReader = {
  order: {
    findFirst: (args: {
      where: Record<string, unknown>;
      select: { publicId: true };
    }) => Promise<{ publicId: number } | null>;
  };
};

/**
 * The same lookup, through whichever client is passed.
 *
 * It is run twice: once before the order is priced, so the customer gets a
 * useful message, and again inside the transaction that takes their money.
 * The first check alone loses the race it exists to win — two submissions a
 * few milliseconds apart both read "no duplicate" and both charge — which is
 * exactly the double-click this is here to stop.
 */
export async function findDuplicate(
  client: OrderReader,
  userId: string,
  serviceId: string,
  link: string,
  since: Date,
): Promise<{ publicId: number } | null> {
  return client.order.findFirst({
    where: { userId, serviceId, link, status: { in: COUNTED_STATUSES }, createdAt: { gt: since } },
    select: { publicId: true },
  });
}

/**
 * How many orders one account may start in a minute.
 *
 * `incoming` is the size of the batch about to be placed, so a mass paste is
 * weighed as a whole rather than slipping through one line at a time.
 */
export async function orderRateLimit(userId: string, incoming = 1): Promise<GuardResult> {
  const limit = Number(await getSetting("order.maxPerMinute")) || 0;
  if (limit <= 0) return null;

  const placed = await db.order.count({
    where: { userId, createdAt: { gt: new Date(Date.now() - 60_000) } },
  });
  if (placed + incoming <= limit) return null;

  // English has a singular and a plural here; the count picks the sentence.
  return { key: limit === 1 ? "err.rateLimitOne" : "err.rateLimit", vars: { limit } };
}

/**
 * A link or an account the operator has banned.
 *
 * Links match on containment so one entry covers a domain and every path
 * under it; usernames match whole, because half a username is somebody else.
 * Both comparisons are case-insensitive, which SQLite gives for free on
 * `contains` but not on equality, so the username side is folded by hand.
 */
export async function blocklisted(username: string, link: string): Promise<GuardResult> {
  const rows = await db.blocklist.findMany({ select: { kind: true, value: true } });
  if (rows.length === 0) return null;

  const haystack = link.toLowerCase();
  const account = username.toLowerCase();

  for (const row of rows) {
    const value = row.value.trim().toLowerCase();
    if (!value) continue;
    if (row.kind === "link" && haystack.includes(value)) return { key: "err.blockedLink" };
    if (row.kind === "username" && account === value) return { key: "err.blockedAccount" };
  }
  return null;
}

/**
 * The same link, from accounts that are not this one.
 *
 * The per-account limits above are trivially beaten by opening a second
 * account, and this is the only check that looks across them. It counts
 * distinct accounts rather than orders, so one customer re-ordering their own
 * link all day never trips it.
 */
export async function sharedLink(userId: string, link: string): Promise<string | null> {
  const accounts = Number(await getSetting("guard.sharedLinkAccounts")) || 0;
  if (accounts <= 0) return null;

  const hours = Number(await getSetting("guard.sharedLinkHours")) || 24;
  const others = await db.order.findMany({
    where: {
      link,
      userId: { not: userId },
      status: { in: COUNTED_STATUSES },
      createdAt: { gt: new Date(Date.now() - hours * 3_600_000) },
    },
    select: { userId: true },
    distinct: ["userId"],
    // One more than the threshold is enough to know it was crossed.
    take: accounts,
  });

  // The account placing this one counts too: a threshold of 3 means three
  // accounts on one link, not three others plus this one.
  if (others.length + 1 < accounts) return null;
  return englishMessage("hold.sharedLink", { accounts: others.length + 1, hours });
}

/**
 * A young or unfunded account spending more than the operator is willing to
 * front.
 *
 * Age is measured from registration, and "unfunded" means no completed
 * deposit has ever landed — an account topped up by an admin by hand is not
 * evidence of a working card, but it is evidence a human looked at it, so it
 * counts as funded.
 */
export async function newAccountCeiling(userId: string, charge: number): Promise<string | null> {
  const [minutesRaw, ceilingRaw] = await Promise.all([
    getSetting("guard.minAccountAgeMinutes"),
    getSetting("guard.newAccountMaxCharge"),
  ]);
  const ceiling = Number(ceilingRaw) || 0;
  if (ceiling <= 0 || charge <= ceiling) return null;

  const minutes = Number(minutesRaw) || 0;
  const user = await db.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
  if (!user) return null;

  const ageMinutes = Math.floor((Date.now() - user.createdAt.getTime()) / 60_000);
  const young = minutes > 0 && ageMinutes < minutes;

  const deposits = await db.transaction.count({
    where: { userId, type: "deposit", status: "completed" },
  });
  const unfunded = deposits === 0;

  if (!young && !unfunded) return null;
  // Both in the base currency, written the way it writes numbers. The charge
  // used to be rounded to a whole unit while the ceiling beside it was not, so
  // a $4.25 order stopped by a $4.00 ceiling was recorded as "ordering 4
  // (ceiling 4)" — a note that contradicts the decision it explains.
  const money = await getBaseCurrency();
  return englishMessage(young ? "hold.youngAccount" : "hold.unfundedAccount", {
    charge: formatMoney(charge, money),
    ceiling: formatMoney(ceiling, money),
    minutes,
  });
}

/**
 * Every check, in the order a customer would hit them.
 *
 * Refusals are asked first: there is no point holding an order for review
 * that was never going to be accepted. `charge` is optional because the two
 * callers know it at different points — the API knows it before it asks, the
 * form works out drip-feed runs first — and a caller that cannot supply it
 * simply skips the ceiling.
 */
export async function guardOrder(
  userId: string,
  serviceId: string,
  link: string,
  incoming = 1,
  extra?: { username: string; charge: number },
): Promise<GuardVerdict> {
  const refusal =
    (await orderRateLimit(userId, incoming)) ??
    (await duplicateOrder(userId, serviceId, link)) ??
    (extra ? await blocklisted(extra.username, link) : null);
  if (refusal) return { block: refusal };

  const hold = (await sharedLink(userId, link)) ?? (extra ? await newAccountCeiling(userId, extra.charge) : null);
  if (hold) return { hold };

  return null;
}
