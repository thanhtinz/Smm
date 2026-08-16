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
  /**
   * Which currency `charge` is counted in. The `status` action has always said
   * so and this had not, leaving a reseller to guess — and to guess wrong the
   * day an operator changes the panel's base.
   *
   * `charge` itself stays a JSON number rather than becoming the fixed-point
   * string the API returns. Resellers are already parsing this payload; 4.2
   * and "4.20" are the same amount, and changing the type would break them for
   * no gain.
   */
  currency: string;
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
  // Read through the handed-in client, the same way the owner lookup above is
  // — this module stays free of its own database import so the pure helpers
  // beside it can be used by client components.
  currency: {
    findFirst: (args: { where: { isBase: true } }) => Promise<{ code: string } | null>;
  };
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
    currency: (await client.currency.findFirst({ where: { isBase: true } }))?.code ?? "",
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
