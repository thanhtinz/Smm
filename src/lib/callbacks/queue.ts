import { apiStatus } from "@/lib/api-status";

/**
 * Writing a callback into the queue.
 *
 * Split from the delivery half deliberately. This is called from
 * `recordOrderStep`, which lives in `orders.ts`, which client components
 * import for its pure helpers — so anything reachable from here ends up in the
 * browser bundle. Delivery needs the database, the panel scope and settings;
 * none of that belongs there, so none of it is imported here. The queue writes
 * through whatever client it is handed, which is the transaction's.
 */

/** Only these are worth a call: the rest are steps along the way. */
const NOTIFIED = new Set(["completed", "partial", "canceled", "refunded"]);

export type CallbackBody = {
  order: number;
  status: string;
  start_count: number;
  remains: number;
  charge: number;
};

/** Prisma checks create data against an exact shape, so it is spelled out. */
type CallbackRow = {
  panelId: string;
  userId: string;
  orderId: string;
  publicId: number;
  payload: string;
};

export type QueueClient = {
  user: {
    findUnique: (args: {
      where: { id: string };
      select: { callbackUrl: true };
    }) => Promise<{ callbackUrl: string } | null>;
  };
  callback: { create: (args: { data: CallbackRow }) => Promise<unknown> };
};

/**
 * Queues a callback, if this order's owner asked for them.
 *
 * Called from inside the transaction that writes the status, with that
 * transaction's client — the row and the status commit together or not at all.
 * Silent when the account has no callback URL, which is nearly every account.
 */
export async function queueCallback(
  client: QueueClient,
  order: { id: string; panelId: string; publicId: number; userId: string; charge: number },
  next: { status: string; startCount: number; remains: number },
): Promise<void> {
  if (!NOTIFIED.has(next.status)) return;

  const owner = await client.user.findUnique({ where: { id: order.userId }, select: { callbackUrl: true } });
  if (!owner?.callbackUrl) return;

  const body: CallbackBody = {
    order: order.publicId,
    // The same wording the `status` action answers with, so a reseller has
    // one set of strings to handle rather than two.
    status: apiStatus(next.status),
    start_count: next.startCount,
    remains: next.remains,
    charge: order.charge,
  };

  await client.callback.create({
    data: {
      panelId: order.panelId,
      userId: order.userId,
      orderId: order.id,
      publicId: order.publicId,
      payload: JSON.stringify(body),
    },
  });
}
