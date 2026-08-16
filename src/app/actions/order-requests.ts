"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { openRequest, resolveRequest } from "@/lib/requests";
import { deny } from "@/lib/access";
import { readerMessages } from "@/lib/context";

export type RequestState = {
  error?: string;
  ok?: true;
  /** The order was cancelled outright rather than queued for an operator. */
  cancelled?: true;
};

export async function createOrderRequestAction(orderId: string, type: string): Promise<RequestState> {
  const t = await readerMessages();
  const user = await getCurrentUser();
  if (!user) return { error: t("err.sessionShort") };
  if (type !== "refill" && type !== "cancel") return { error: t("err.requestType") };

  const barred = deny(user, type);
  if (barred) return { error: t(barred.key) };

  const outcome = await openRequest(user.id, orderId, type);
  if ("key" in outcome) return { error: t(outcome.key, outcome.vars) };

  revalidatePath("/dashboard/orders");
  revalidatePath("/admin/requests");
  // A scheduled order that had not started is already cancelled and refunded;
  // there is no request for anyone to approve, and saying "waiting for
  // approval" would send the customer looking for one.
  return outcome.cancelled ? { ok: true, cancelled: true } : { ok: true };
}

export async function resolveOrderRequestAction(id: string, decision: string, note = ""): Promise<RequestState> {
  const t = await readerMessages();
  const admin = await requireAdmin();
  const outcome = await resolveRequest(id, decision, note, admin.id);
  return "key" in outcome ? { error: t(outcome.key, outcome.vars) } : outcome;
}
