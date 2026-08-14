"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser, logActivity, requireAdmin } from "@/lib/auth";
import { nextPublicId } from "@/lib/ids";
import { getSetting } from "@/lib/settings";
import { resolveRequest } from "@/lib/requests";
import { readerMessages } from "@/lib/context";

export type RequestState = { error?: string; ok?: true };

/** Refill only makes sense once delivery has finished or stalled. */
const REFILLABLE = new Set(["completed", "partial"]);
/** Cancel only makes sense before the provider has really started. */
const CANCELLABLE = new Set(["pending", "processing"]);

export async function createOrderRequestAction(orderId: string, type: string): Promise<RequestState> {
  const t = await readerMessages();
  const user = await getCurrentUser();
  if (!user) return { error: t("err.sessionShort") };
  if (type !== "refill" && type !== "cancel") return { error: t("err.requestType") };

  const order = await db.order.findFirst({
    where: { id: orderId, userId: user.id },
    include: { service: { select: { refill: true, cancel: true, name: true } } },
  });
  if (!order) return { error: t("err.orderGone") };

  if (type === "refill") {
    if (!order.service.refill) return { error: t("err.noRefill") };
    if (!REFILLABLE.has(order.status)) return { error: t("err.refillState") };

    const days = Number(await getSetting("order.refillWindowDays")) || 0;
    if (days > 0 && order.updatedAt.getTime() < Date.now() - days * 864e5) {
      return { error: t("err.refillWindow", { days }) };
    }
  } else {
    if (!(await getSetting("order.allowCancelRequests"))) {
      return { error: t("err.cancelDisabled") };
    }
    if (!order.service.cancel) return { error: t("err.noCancel") };
    if (!CANCELLABLE.has(order.status)) return { error: t("err.cancelStarted") };
  }

  const open = await db.orderRequest.findFirst({
    where: { orderId, type, status: { in: ["pending", "approved"] } },
    select: { id: true },
  });
  if (open) return { error: t("err.requestOpen") };

  await db.orderRequest.create({
    data: { publicId: await nextPublicId("request"), orderId, userId: user.id, type },
  });

  await logActivity(user.id, `order.${type}.request`, `#${order.publicId}`);
  revalidatePath("/dashboard/orders");
  revalidatePath("/admin/requests");
  return { ok: true };
}

export async function resolveOrderRequestAction(id: string, decision: string, note = ""): Promise<RequestState> {
  const t = await readerMessages();
  const admin = await requireAdmin();
  const outcome = await resolveRequest(id, decision, note, admin.id);
  return "key" in outcome ? { error: t(outcome.key, outcome.vars) } : outcome;
}
