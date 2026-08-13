"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser, logActivity, requireAdmin } from "@/lib/auth";
import { nextPublicId } from "@/lib/ids";
import { getSetting } from "@/lib/settings";

export type RequestState = { error?: string; ok?: true };

/** Refill only makes sense once delivery has finished or stalled. */
const REFILLABLE = new Set(["completed", "partial"]);
/** Cancel only makes sense before the provider has really started. */
const CANCELLABLE = new Set(["pending", "processing"]);

export async function createOrderRequestAction(orderId: string, type: string): Promise<RequestState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session expired." };
  if (type !== "refill" && type !== "cancel") return { error: "Unknown request type" };

  const order = await db.order.findFirst({
    where: { id: orderId, userId: user.id },
    include: { service: { select: { refill: true, cancel: true, name: true } } },
  });
  if (!order) return { error: "That order no longer exists." };

  if (type === "refill") {
    if (!order.service.refill) return { error: "This service does not offer refill." };
    if (!REFILLABLE.has(order.status)) return { error: "Refill can only be requested on a completed or partial order." };

    const days = Number(await getSetting("order.refillWindowDays")) || 0;
    if (days > 0 && order.updatedAt.getTime() < Date.now() - days * 864e5) {
      return { error: `The refill window for this order closed after ${days} days.` };
    }
  } else {
    if (!(await getSetting("order.allowCancelRequests"))) {
      return { error: "Cancellation requests are currently disabled." };
    }
    if (!order.service.cancel) return { error: "This service does not allow cancellation." };
    if (!CANCELLABLE.has(order.status)) return { error: "This order has already started and cannot be cancelled." };
  }

  const open = await db.orderRequest.findFirst({
    where: { orderId, type, status: { in: ["pending", "approved"] } },
    select: { id: true },
  });
  if (open) return { error: "There is already an open request for this order." };

  await db.orderRequest.create({
    data: { publicId: await nextPublicId("request"), orderId, userId: user.id, type },
  });

  await logActivity(user.id, `order.${type}.request`, `#${order.publicId}`);
  revalidatePath("/dashboard/orders");
  revalidatePath("/admin/requests");
  return { ok: true };
}

/**
 * Approving a cancel returns the customer's money; approving a refill does
 * not, since the delivery is being redone rather than reversed.
 */
export async function resolveOrderRequestAction(id: string, decision: string, note = ""): Promise<RequestState> {
  const admin = await requireAdmin();
  if (!["approved", "rejected", "completed"].includes(decision)) return { error: "Unknown decision" };

  const request = await db.orderRequest.findUnique({ where: { id }, include: { order: true } });
  if (!request) return { error: "That request no longer exists." };
  if (request.status === "rejected" || request.status === "completed") {
    return { error: "This request has already been resolved." };
  }

  const refundsNow = request.type === "cancel" && decision === "approved";
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

  await db.notification.create({
    data: {
      userId: request.userId,
      title: `${request.type === "refill" ? "Refill" : "Cancellation"} request ${decision}`,
      body: note || `Order #${request.order.publicId}`,
      level: decision === "rejected" ? "warning" : "success",
      href: "/dashboard/orders",
    },
  });

  await logActivity(admin.id, `admin.request.${decision}`, `${request.type} #${request.publicId}`);
  revalidatePath("/admin/requests");
  revalidatePath("/dashboard/orders");
  return { ok: true };
}
