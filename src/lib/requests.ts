import { revalidatePath } from "next/cache";
import { db } from "./db";
import { basePrisma } from "./db-base";
import { logActivity } from "./auth";
import { nextPublicId } from "./ids";
import { runAsPanel } from "./tenancy";
import { requestProviderCancel, requestProviderRefill } from "./providers";

export type RequestOutcome = { error?: string; ok?: true };

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
): Promise<{ error?: string }> {
  if (target.kind === "provider") {
    const order = await db.order.findUniqueOrThrow({
      where: { id: target.orderId },
      include: { provider: true, service: { include: { provider: true } } },
    });
    // Whoever took the order is who can refill or cancel it.
    const provider = order.provider ?? order.service.provider;
    if (!provider?.enabled) return { error: "The provider for this order is disabled." };

    const result =
      request.type === "refill"
        ? await requestProviderRefill(provider, order.providerOrderId)
        : await requestProviderCancel(provider, order.providerOrderId);

    if (!result.ok) return { error: result.error };
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
  if (!["approved", "rejected", "completed"].includes(decision)) return { error: "Unknown decision" };

  const request = await db.orderRequest.findUnique({ where: { id }, include: { order: true } });
  if (!request) return { error: "That request no longer exists." };
  if (request.status === "rejected" || request.status === "completed") {
    return { error: "This request has already been resolved." };
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

    await tx.order.update({ where: { id: order.id }, data: { status: "canceled" } });

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
      error: error instanceof Error ? error.message : "Could not pass this request on.",
    }));
    if (outcome.error) {
      await db.orderRequest.update({ where: { id }, data: { note: outcome.error } });
      await logActivity(actorId, "request.forward.failed", `${request.type} #${request.publicId}: ${outcome.error}`);
    }
  }

  await db.notification.create({
    data: {
      userId: request.userId,
      title: `${request.type === "refill" ? "Refill" : "Cancellation"} request ${decision}`,
      body: note || `Order #${request.order.publicId}`,
      level: decision === "rejected" ? "warning" : "success",
      href: "/dashboard/orders",
    },
  });

  await logActivity(actorId, `${actorId ? "admin" : "auto"}.request.${decision}`, `${request.type} #${request.publicId}`);
  revalidatePath("/admin/requests");
  revalidatePath("/dashboard/orders");
  return { ok: true };
}
