import { db } from "@/lib/db";

/**
 * What a service actually did, measured from its own orders.
 *
 * Every panel in this market quotes three figures — warranty, time to start,
 * speed per day — and at every one of them those figures are what the operator
 * typed. Nothing checks them and nothing can.
 *
 * This panel records each order's status changes in OrderEvent, with the time
 * and the counts as they stood. So the same three questions have answers here
 * that were not typed by anybody: how long orders really took to start, how
 * long they took to finish, and how many came back for a refill. The measured
 * number is shown *beside* the stated one, never instead of it — the operator
 * is promising something, and a promise and a track record are different
 * claims.
 *
 * Silence over zeros. A service with three orders behind it has no track
 * record, and printing "0 minutes" for it would be a worse lie than saying
 * nothing.
 */
export type ServiceStats = {
  /** Median minutes from placing an order to the first sign of movement. */
  startMinutes: number | null;
  /** Median minutes from placing to completed. */
  finishMinutes: number | null;
  /** Refills requested per hundred finished orders. */
  refillRate: number | null;
  /** How many finished orders the figures above were drawn from. */
  sample: number;
};

/**
 * Below this an average is noise: one slow night decides it. Kept low enough
 * that a service selling steadily gets a track record within a week, and high
 * enough that a single order never becomes a claim.
 */
const ENOUGH = 10;

/** The middle value, not the mean: one order stuck for a week moves a mean. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

const MOVING = new Set(["processing", "inprogress", "completed", "partial"]);

type Row = {
  serviceId: string;
  createdAt: Date;
  settledAt: Date | null;
  events: { to: string; createdAt: Date }[];
  requests: { id: string }[];
};

function summarise(orders: Row[]): ServiceStats {
  if (orders.length < ENOUGH) {
    return { startMinutes: null, finishMinutes: null, refillRate: null, sample: orders.length };
  }

  const minutes = (from: Date, to: Date) => Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000));
  const starts: number[] = [];
  const finishes: number[] = [];
  let refilled = 0;

  for (const order of orders) {
    // The first event meaning the provider picked it up. An order whose events
    // were never recorded — placed before that table existed — contributes
    // nothing rather than a zero.
    const moved = order.events.find((e) => MOVING.has(e.to));
    if (moved) starts.push(minutes(order.createdAt, moved.createdAt));
    if (order.settledAt) finishes.push(minutes(order.createdAt, order.settledAt));
    if (order.requests.length > 0) refilled++;
  }

  return {
    startMinutes: starts.length >= ENOUGH ? median(starts) : null,
    finishMinutes: finishes.length >= ENOUGH ? median(finishes) : null,
    refillRate: Math.round((refilled / orders.length) * 100),
    sample: orders.length,
  };
}

/**
 * One query for however many services are on the page.
 *
 * A query per service would be a hundred round trips on the order form, so
 * the recent orders for all of them come back together and are grouped here.
 * `perService` is the window each service is judged on — the newest orders
 * beyond it are dropped, so a service that was slow a year ago and is fast now
 * reads as fast now.
 */
export async function serviceStatsMany(serviceIds: string[], perService = 200): Promise<Map<string, ServiceStats>> {
  const out = new Map<string, ServiceStats>();
  if (serviceIds.length === 0) return out;

  const orders = await db.order.findMany({
    where: { serviceId: { in: serviceIds }, status: { in: ["completed", "partial"] } },
    orderBy: { createdAt: "desc" },
    // A ceiling on the whole query rather than none at all: a panel with a
    // million finished orders should not read all of them to fill four tiles.
    take: Math.min(serviceIds.length, 40) * perService,
    select: {
      serviceId: true,
      createdAt: true,
      settledAt: true,
      events: { orderBy: { createdAt: "asc" }, select: { to: true, createdAt: true } },
      requests: { where: { type: "refill" }, select: { id: true } },
    },
  });

  const grouped = new Map<string, Row[]>();
  for (const order of orders) {
    const rows = grouped.get(order.serviceId) ?? [];
    // Newest first from the query, so the window is the first N of each.
    if (rows.length < perService) rows.push(order);
    grouped.set(order.serviceId, rows);
  }

  for (const id of serviceIds) out.set(id, summarise(grouped.get(id) ?? []));
  return out;
}

/** One service, same rules. */
export async function serviceStats(serviceId: string, take = 200): Promise<ServiceStats> {
  return (await serviceStatsMany([serviceId], take)).get(serviceId)!;
}
