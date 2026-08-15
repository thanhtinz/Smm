import { revalidatePath } from "next/cache";
import { db } from "./db";
import { basePrisma } from "./db-base";
import { logActivity } from "./auth";
import { getSetting } from "./settings";
import { nextPublicId } from "./ids";
import { runAsPanel } from "./tenancy";
import { requestProviderCancel, requestProviderRefill } from "./providers";
import { notification, requestKey } from "./notify";
import { englishMessage, type Fault } from "./fault";
import { withSettled, recordOrderStep, notStartedYet } from "./orders";

/**
 * Refusals here are read three ways at once: shown to an admin, written into
 * the request's note and copied into the activity log — and the cron pass that
 * auto-approves has no reader at all. So this says what was wrong and leaves
 * the wording to each of them.
 */
/**
 * The note on a cancellation the panel made itself.
 *
 * Stored as a translation key rather than a sentence: every other note on a
 * request was typed by an operator for the customer who raised it, and is
 * shown as written — this one is the panel talking, and would otherwise be
 * the single English line on a Vietnamese order page.
 */
export const AUTO_CANCEL_NOTE = "order.cancelledBeforeStart";

/** Refill only makes sense once delivery has finished or stalled. */
const REFILLABLE = new Set(["completed", "partial"]);
/**
 * Cancel only makes sense before the provider has really started. A held
 * order is the cleanest case of all — nothing was sent anywhere, so there is
 * only money to hand back.
 */
const CANCELLABLE = new Set(["held", "pending", "processing"]);

/**
 * Raises a refill or cancel request for one order, or says why not.
 *
 * The web form and API v2 both come through here. They used to be one place
 * because only the form existed; the API advertised `refill: true` on every
 * service and had no action to match, so a reseller was told a thing the
 * panel would not then do.
 */
export async function openRequest(
  userId: string,
  orderId: string,
  type: "refill" | "cancel",
): Promise<{ publicId: number; cancelled?: true } | Fault> {
  const order = await db.order.findFirst({
    where: { id: orderId, userId },
    include: { service: { select: { refill: true, cancel: true } } },
  });
  if (!order) return { key: "err.orderGone" };

  // An order waiting for its scheduled hour has not been bought from anyone:
  // no provider has it, nothing is running, and the only thing that happened
  // was taking the money. Sending that through the approval queue — and
  // refusing it outright on a service whose provider does not do cancels —
  // made the customer wait on an operator for a decision the panel could make
  // on its own, about work it had not started.
  if (type === "cancel" && notStartedYet(order)) {
    return cancelBeforeStart(order);
  }

  if (type === "refill") {
    if (!order.service.refill) return { key: "err.noRefill" };
    if (!REFILLABLE.has(order.status)) return { key: "err.refillState" };

    const days = Number(await getSetting("order.refillWindowDays")) || 0;
    if (days > 0 && order.updatedAt.getTime() < Date.now() - days * 864e5) {
      return { key: "err.refillWindow", vars: { days } };
    }
  } else {
    if (!(await getSetting("order.allowCancelRequests"))) return { key: "err.cancelDisabled" };
    if (!order.service.cancel) return { key: "err.noCancel" };
    if (!CANCELLABLE.has(order.status)) return { key: "err.cancelStarted" };
  }

  const open = await db.orderRequest.findFirst({
    where: { orderId, type, status: { in: ["pending", "approved"] } },
    select: { id: true },
  });
  if (open) return { key: "err.requestOpen" };

  const publicId = await nextPublicId("request");
  await db.orderRequest.create({ data: { publicId, orderId, userId, type } });
  await logActivity(userId, `order.${type}.request`, `#${order.publicId}`);
  return { publicId };
}

/**
 * Cancels a booking and hands the money back, in one transaction.
 *
 * The status is re-read inside it and the same three conditions checked
 * again: between the read above and this write the dispatcher may have sent
 * the order upstream, and refunding one that is now running would pay for
 * work the panel is still going to be charged for.
 */
async function cancelBeforeStart(order: {
  id: string;
  publicId: number;
  userId: string;
  charge: number;
}): Promise<{ publicId: number; cancelled: true } | Fault> {
  // Both numbers are allocated before the transaction opens: nextPublicId
  // reads a counter of its own, and doing that inside would hold the write
  // lock across a second round trip.
  const [refundPublicId, requestPublicId] = [await nextPublicId("transaction"), await nextPublicId("request")];

  const done = await db.$transaction(async (tx) => {
    const fresh = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
    if (!notStartedYet(fresh)) return false;

    await tx.order.update({ where: { id: fresh.id }, data: withSettled({ status: "canceled" }) });
    await recordOrderStep(tx, fresh, { status: "canceled" }, "customer");

    const user = await tx.user.findUniqueOrThrow({
      where: { id: fresh.userId },
      select: { balance: true, spent: true },
    });
    const balanceAfter = user.balance + fresh.charge;

    await tx.user.update({
      where: { id: fresh.userId },
      data: { balance: balanceAfter, spent: Math.max(0, user.spent - fresh.charge) },
    });
    await tx.transaction.create({
      data: {
        publicId: refundPublicId,
        userId: fresh.userId,
        type: "refund",
        amount: fresh.charge,
        status: "completed",
        reference: String(fresh.publicId),
        note: `Cancellation of scheduled order #${fresh.publicId}`,
        balanceAfter,
      },
    });

    // Recorded as an approved request even though nobody approved it, so the
    // request log is a complete account of every cancellation rather than one
    // with the automatic ones missing — and so every caller still has a
    // number to be told.
    await tx.orderRequest.create({
      data: {
        publicId: requestPublicId,
        orderId: fresh.id,
        userId: fresh.userId,
        type: "cancel",
        status: "approved",
        note: AUTO_CANCEL_NOTE,
      },
    });
    return true;
  });

  // Lost the race: it went upstream while this was being decided, so it is an
  // ordinary running order now and takes the ordinary route.
  if (!done) return { key: "err.cancelStarted" };

  await logActivity(order.userId, "order.cancel.scheduled", `#${order.publicId}`);
  return { publicId: requestPublicId, cancelled: true };
}

export type RequestOutcome = { ok?: true } | Fault;

/**
 * Approving a cancel returns the customer's money; approving a refill does
 * not, since the delivery is being redone rather than reversed.
 */
type Forward =
  | { kind: "panel"; panelId: string; orderId: string; ownerUserId: string }
  | { kind: "provider"; orderId: string };

/**
 * How this order reaches whoever can actually refill or cancel it: the panel
 * above, an outside provider, or neither.
 */
async function forwardTarget(orderId: string): Promise<Forward | null> {
  const upstream = await basePrisma.order.findFirst({
    where: { sourceOrderId: orderId },
    select: { id: true, panelId: true, userId: true },
  });
  if (upstream) {
    return { kind: "panel", panelId: upstream.panelId, orderId: upstream.id, ownerUserId: upstream.userId };
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, providerOrderId: true, providerId: true, service: { select: { providerId: true } } },
  });
  if (order?.providerOrderId && (order.providerId ?? order.service.providerId)) {
    return { kind: "provider", orderId: order.id };
  }
  return null;
}

/** Raises the same request one level up, or sends it to the provider. */
async function forwardRequest(
  request: { id: string; type: string; publicId: number },
  target: Forward,
): Promise<Fault | Record<string, never>> {
  if (target.kind === "provider") {
    const order = await db.order.findUniqueOrThrow({
      where: { id: target.orderId },
      include: { provider: true, service: { include: { provider: true } } },
    });
    // Whoever took the order is who can refill or cancel it.
    const provider = order.provider ?? order.service.provider;
    if (!provider?.enabled) return { key: "adm.providerDisabled" };

    const result =
      request.type === "refill"
        ? await requestProviderRefill(provider, order.providerOrderId)
        : await requestProviderCancel(provider, order.providerOrderId);

    if (!result.ok) return { key: "adm.providerCallFailed", vars: { detail: result.error } };
    await db.orderRequest.update({ where: { id: request.id }, data: { providerRequestId: result.data } });
    return {};
  }

  // Ids come from the panel above, so they are allocated in its scope.
  const publicId = await runAsPanel(target.panelId, () => nextPublicId("request"));
  await runAsPanel(target.panelId, async () =>
    db.orderRequest.create({
      data: {
        publicId,
        orderId: target.orderId,
        userId: target.ownerUserId,
        type: request.type,
        status: "pending",
        sourceRequestId: request.id,
        note: `Raised by a reseller for request #${request.publicId}`,
      },
    }),
  );
  return {};
}

/**
 * Answers a refill or cancel request.
 *
 * `actorId` is the admin who decided, or null when the panel decided for
 * itself under its auto-resolve rules — the activity log says which.
 */
export async function resolveRequest(
  id: string,
  decision: string,
  note = "",
  actorId: string | null = null,
): Promise<RequestOutcome> {
  if (!["approved", "rejected", "completed"].includes(decision)) return { key: "adm.unknownDecision" };

  const request = await db.orderRequest.findUnique({ where: { id }, include: { order: true } });
  if (!request) return { key: "adm.requestMissing" };
  if (request.status === "rejected" || request.status === "completed") {
    return { key: "adm.requestResolved" };
  }

  // Where this order is actually fulfilled decides what "approved" can do
  // here. A panel that bought the order from somewhere else can only pass the
  // request on; the money moves when the answer comes back.
  const forward = decision === "approved" ? await forwardTarget(request.orderId) : null;

  const refundsNow = request.type === "cancel" && decision === "approved" && forward === null;
  const refundPublicId = refundsNow ? await nextPublicId("transaction") : 0;

  await db.$transaction(async (tx) => {
    await tx.orderRequest.update({ where: { id }, data: { status: decision, note } });

    if (!refundsNow) return;

    // Guarded on the order's own status so a second approval cannot pay twice.
    const order = await tx.order.findUniqueOrThrow({ where: { id: request.orderId } });
    if (order.status === "canceled" || order.status === "refunded") return;

    await tx.order.update({ where: { id: order.id }, data: withSettled({ status: "canceled" }) });
    await recordOrderStep(tx, order, { status: "canceled" }, "customer");

    const user = await tx.user.findUniqueOrThrow({
      where: { id: order.userId },
      select: { balance: true, spent: true },
    });
    const balanceAfter = user.balance + order.charge;

    await tx.user.update({
      where: { id: order.userId },
      data: { balance: balanceAfter, spent: Math.max(0, user.spent - order.charge) },
    });
    await tx.transaction.create({
      data: {
        publicId: refundPublicId,
        userId: order.userId,
        type: "refund",
        amount: order.charge,
        status: "completed",
        reference: String(order.publicId),
        note: `Cancellation of order #${order.publicId}`,
        balanceAfter,
      },
    });
  });

  if (forward) {
    // The local decision has already been written, so a failure upstream must
    // not throw here. It is recorded on the request instead, where an operator
    // can see it and retry rather than guess.
    const outcome = await forwardRequest(request, forward).catch((error: unknown) => ({
      key: "adm.forwardFailed",
      vars: { detail: error instanceof Error ? error.message : "" },
    }));
    if ("key" in outcome) {
      // Stored and logged, so English: the note outlives whoever is signed in.
      const note = englishMessage(outcome.key, outcome.vars);
      await db.orderRequest.update({ where: { id }, data: { note } });
      await logActivity(actorId, "request.forward.failed", `${request.type} #${request.publicId}: ${note}`);
    }
  }

  await db.notification.create({
    data: notification({
      userId: request.userId,
      key: requestKey(request.type, decision),
      params: { orderId: request.order.publicId, ...(note ? { note } : {}) },
      level: decision === "rejected" ? "warning" : "success",
      href: "/dashboard/orders",
    }),
  });

  await logActivity(actorId, `${actorId ? "admin" : "auto"}.request.${decision}`, `${request.type} #${request.publicId}`);
  revalidatePath("/admin/requests");
  revalidatePath("/dashboard/orders");
  return { ok: true };
}
