/**
 * How each provider is actually behaving, from the orders they took.
 *
 * A panel finds out a supplier has gone bad the same way its customers do:
 * through refunds and complaints. Everything needed to see it sooner is
 * already in the order table — who took each order, what it became, and how
 * long it sat there. This reads it.
 */

import { db } from "./db";
import { SETTLED_ORDER_STATUSES } from "./orders";

export type ProviderHealth = {
  providerId: string;
  /** Orders taken in the window, whatever became of them. */
  taken: number;
  completed: number;
  partial: number;
  failed: number;
  /** Still moving: not yet a verdict either way. */
  running: number;
  /** completed / settled, as a percentage. Null when nothing has settled. */
  successRate: number | null;
  /** Median seconds from placing to settling, of those that settled. */
  medianSeconds: number | null;
  /** What the panel spent with them in the window, in base currency. */
  spend: number;
};

/** A middle value beats a mean here: one week-long straggler skews a mean. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

const FAILED = new Set(["canceled", "refunded"]);

/**
 * One pass over the window's orders rather than a query per provider: a panel
 * with twenty providers would otherwise run twenty of everything.
 */
export async function providerHealth(days = 30): Promise<Map<string, ProviderHealth>> {
  const since = new Date(Date.now() - days * 864e5);
  const orders = await db.order.findMany({
    where: { providerId: { not: null }, createdAt: { gte: since } },
    select: { providerId: true, status: true, cost: true, createdAt: true, settledAt: true },
  });

  const byProvider = new Map<string, { rows: typeof orders; durations: number[] }>();
  for (const order of orders) {
    const key = order.providerId!;
    const bucket = byProvider.get(key) ?? { rows: [], durations: [] };
    bucket.rows.push(order);
    // Only orders that actually finished can say how long finishing takes.
    if (order.settledAt) {
      bucket.durations.push(Math.round((order.settledAt.getTime() - order.createdAt.getTime()) / 1000));
    }
    byProvider.set(key, bucket);
  }

  const out = new Map<string, ProviderHealth>();
  for (const [providerId, { rows, durations }] of byProvider) {
    const count = (test: (s: string) => boolean) => rows.filter((r) => test(r.status)).length;
    const completed = count((s) => s === "completed");
    const partial = count((s) => s === "partial");
    const failed = count((s) => FAILED.has(s));
    const settled = count((s) => SETTLED_ORDER_STATUSES.includes(s as never));

    out.set(providerId, {
      providerId,
      taken: rows.length,
      completed,
      partial,
      failed,
      running: rows.length - settled,
      // A partial is not a success: the customer got less than they paid for.
      successRate: settled > 0 ? Math.round((completed / settled) * 100) : null,
      medianSeconds: median(durations),
      spend: rows.reduce((sum, r) => sum + (r.cost ?? 0), 0),
    });
  }
  return out;
}

/**
 * The services going worst at one provider. An operator with a bad success
 * rate needs to know whether the whole supplier has gone or one service has.
 */
export async function worstServices(providerId: string, days = 30, take = 5) {
  const since = new Date(Date.now() - days * 864e5);
  const orders = await db.order.findMany({
    where: { providerId, createdAt: { gte: since } },
    select: { serviceId: true, status: true, service: { select: { name: true, publicId: true } } },
  });

  const byService = new Map<string, { name: string; publicId: number; settled: number; bad: number }>();
  for (const order of orders) {
    if (!SETTLED_ORDER_STATUSES.includes(order.status as never)) continue;
    const row = byService.get(order.serviceId) ?? {
      name: order.service.name,
      publicId: order.service.publicId,
      settled: 0,
      bad: 0,
    };
    row.settled += 1;
    if (order.status !== "completed") row.bad += 1;
    byService.set(order.serviceId, row);
  }

  return [...byService.values()]
    .filter((r) => r.bad > 0)
    .map((r) => ({ ...r, rate: Math.round(((r.settled - r.bad) / r.settled) * 100) }))
    .sort((a, b) => a.rate - b.rate || b.settled - a.settled)
    .slice(0, take);
}
