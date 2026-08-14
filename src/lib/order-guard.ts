import { db } from "./db";
import { getSetting } from "./settings";
import type { Fault } from "./fault";

/**
 * The two checks that stand between an account and a runaway order loop.
 *
 * Both are counted from the Order table rather than from memory, so they hold
 * across a restart and mean the same thing whether the order came from the
 * form, the API or a mass paste — three doors into the same room.
 */

/** Orders that were paid for. A refunded one should not block a retry. */
const COUNTED_STATUSES = ["pending", "processing", "inprogress", "completed", "partial"];

export type GuardResult = Fault | null;

/**
 * The same service on the same link, again, within the window.
 *
 * Almost always a double-click or a client library retrying, and the customer
 * would be charged twice for one delivery. Zero switches it off, for panels
 * whose customers legitimately re-order the same link.
 */
export async function duplicateOrder(userId: string, serviceId: string, link: string): Promise<GuardResult> {
  const minutes = Number(await getSetting("order.duplicateWindowMinutes")) || 0;
  if (minutes <= 0) return null;

  const recent = await db.order.findFirst({
    where: {
      userId,
      serviceId,
      link,
      status: { in: COUNTED_STATUSES },
      createdAt: { gt: new Date(Date.now() - minutes * 60_000) },
    },
    select: { publicId: true },
  });
  if (!recent) return null;

  return { key: "err.duplicateOrder", vars: { id: recent.publicId, minutes } };
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

/** Both checks, in the order a customer would hit them. */
export async function guardOrder(
  userId: string,
  serviceId: string,
  link: string,
  incoming = 1,
): Promise<GuardResult> {
  return (await orderRateLimit(userId, incoming)) ?? (await duplicateOrder(userId, serviceId, link));
}
