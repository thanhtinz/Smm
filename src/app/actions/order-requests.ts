"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser, logActivity, requireAdmin } from "@/lib/auth";
import { nextPublicId } from "@/lib/ids";
import { getSetting } from "@/lib/settings";
import { resolveRequest } from "@/lib/requests";

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

export async function resolveOrderRequestAction(id: string, decision: string, note = ""): Promise<RequestState> {
  const admin = await requireAdmin();
  return resolveRequest(id, decision, note, admin.id);
}
