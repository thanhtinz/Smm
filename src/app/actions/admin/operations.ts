"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, logActivity } from "@/lib/auth";
import { nextPublicId } from "@/lib/ids";
import { creditDeposit } from "@/lib/payments/credit";
import { withSettled, recordOrderStep, readSubscription, ORDER_STATUSES, isValidOrderLink } from "@/lib/orders";
import { planUpstream, writeUpstream } from "@/lib/chain";
import type { ActionResult } from "./catalogue";
import { notification } from "@/lib/notify";
import { readerMessages, getAppContext } from "@/lib/context";
import { getCurrentUser } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/two-factor";
import { dateFormats } from "@/lib/dates";

export type { ActionResult };

/** Statuses that hand the customer's money back. */
const REFUNDING = new Set(["canceled", "refunded"]);

/**
 * Moves an order between statuses and settles the money exactly once.
 * Re-reads the order inside the transaction so two admins clicking at the
 * same time cannot both issue a refund.
 */
export async function setOrderStatusAction(id: string, status: string, note = ""): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();
  if (!ORDER_STATUSES.includes(status as never)) return { error: t("adm.unknownStatus") };

  // Ids come from the counter table on its own connection, so they are
  // allocated before the transaction opens rather than inside it.
  const refundPublicId = REFUNDING.has(status) ? await nextPublicId("transaction") : 0;

  try {
    await db.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({ where: { id }, include: { service: true } });
      if (order.status === status) return;

      const wasRefunded = REFUNDING.has(order.status);
      const willRefund = REFUNDING.has(status);

      const change = {
        status,
        note: note || order.note,
        ...(status === "completed" ? { remains: 0 } : {}),
      };
      await tx.order.update({ where: { id }, data: withSettled(change) });
      await recordOrderStep(tx, order, change, admin.username);

      if (willRefund && !wasRefunded) {
        const user = await tx.user.findUniqueOrThrow({ where: { id: order.userId }, select: { balance: true, spent: true } });
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
            note: `Refund for order #${order.publicId}`,
            balanceAfter,
          },
        });
        await tx.notification.create({
          data: notification({
            userId: order.userId,
            key: "order.refunded",
            params: { id: order.publicId, service: order.service.name },
            level: "warning",
            href: "/dashboard/orders",
          }),
        });
      }
    });
  } catch {
    return { error: t("adm.orderFailed") };
  }

  await logActivity(admin.id, "admin.order.status", `${id} -> ${status}`);
  revalidatePath("/admin/orders");
  revalidatePath("/dashboard/orders");
  return { ok: true };
}

// -------------------------------------------------------------------- users

/**
 * Corrects the facts of an order without touching the money.
 *
 * An operator needs this when a customer pasted the wrong link, or when the
 * provider's start count and remains came back wrong and the numbers the
 * customer sees are misleading. The charge is deliberately not editable —
 * moving money has its own audited paths.
 *
 * Changes stay on this panel. An order already sent upstream cannot have its
 * link changed at the provider, so propagating the edit would only make the
 * chain disagree with reality.
 */
export async function updateOrderAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const id = String(form.get("id") ?? "");
  const order = await db.order.findUnique({ where: { id } });
  if (!order) return { error: t("adm.orderMissing") };

  const link = String(form.get("link") ?? "").trim();
  if (!isValidOrderLink(link)) return { fieldErrors: { link: t("adm.linkRequired") } };

  const startCount = Number(String(form.get("startCount") ?? "").trim());
  if (!Number.isInteger(startCount) || startCount < 0) {
    return { fieldErrors: { startCount: t("adm.wholeNumber") } };
  }

  const remains = Number(String(form.get("remains") ?? "").trim());
  if (!Number.isInteger(remains) || remains < 0) {
    return { fieldErrors: { remains: t("adm.wholeNumber") } };
  }
  if (remains > order.quantity) {
    return { fieldErrors: { remains: t("adm.remainsMax", { quantity: order.quantity.toLocaleString() }) } };
  }

  const changes: string[] = [];
  if (link !== order.link) changes.push(`link ${order.link} -> ${link}`);
  if (startCount !== order.startCount) changes.push(`start ${order.startCount} -> ${startCount}`);
  if (remains !== order.remains) changes.push(`remains ${order.remains} -> ${remains}`);
  if (changes.length === 0) return { ok: true };

  await db.order.update({ where: { id }, data: { link, startCount, remains } });
  await logActivity(admin.id, "admin.order.update", `#${order.publicId} ${changes.join(", ")}`);

  revalidatePath("/admin/orders");
  revalidatePath("/dashboard/orders");
  return { ok: true };
}

export async function adjustBalanceAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const userId = String(form.get("userId") ?? "");
  const amount = Number(String(form.get("amount") ?? "").trim());
  const note = String(form.get("note") ?? "").trim();

  if (!Number.isFinite(amount) || amount === 0) {
    return { fieldErrors: { amount: t("adm.amountNonZero") } };
  }

  const publicId = await nextPublicId("transaction");

  try {
    await db.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { balance: true } });
      const balanceAfter = user.balance + amount;
      if (balanceAfter < 0) throw new Error("NEGATIVE");

      await tx.user.update({ where: { id: userId }, data: { balance: balanceAfter } });
      await tx.transaction.create({
        data: {
          publicId,
          userId,
          type: amount > 0 ? "admin_credit" : "admin_debit",
          amount,
          status: "completed",
          note: note || (amount > 0 ? "Added by admin" : "Removed by admin"),
          balanceAfter,
        },
      });
      await tx.notification.create({
        data: notification({
          userId,
          key: amount > 0 ? "balance.added" : "balance.adjusted",
          // An operator's note is shown as typed rather than translated.
          params: note ? { note } : {},
          level: amount > 0 ? "success" : "warning",
          href: "/dashboard/transactions",
        }),
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "NEGATIVE") {
      return { fieldErrors: { amount: t("adm.balanceNegative") } };
    }
    return { error: t("adm.balanceFailed") };
  }

  await logActivity(admin.id, "admin.balance.adjust", `${userId} ${amount}`);
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserRoleAction(userId: string, role: string): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();
  if (!["user", "support", "admin"].includes(role)) return { error: t("adm.unknownRole") };

  if (userId === admin.id && role !== "admin") {
    return { error: t("adm.noSelfDemote") };
  }

  await db.user.update({ where: { id: userId }, data: { role } });
  await logActivity(admin.id, "admin.user.role", `${userId} -> ${role}`);
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserBanAction(userId: string, banned: boolean, reason = ""): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();
  if (userId === admin.id) return { error: t("adm.noSelfSuspend") };

  await db.user.update({ where: { id: userId }, data: { banned, banReason: banned ? reason : "" } });
  // A suspended user keeps no live sessions.
  if (banned) await db.session.deleteMany({ where: { userId } });

  await logActivity(admin.id, banned ? "admin.user.ban" : "admin.user.unban", userId);
  revalidatePath("/admin/users");
  return { ok: true };
}

// ------------------------------------------------------------- transactions

export async function approveTransactionAction(id: string): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();
  const result = await creditDeposit(id);
  if (result === "missing") return { error: t("adm.depositMissing") };

  await logActivity(admin.id, "admin.deposit.approve", id);
  revalidatePath("/admin/transactions");
  return { ok: true };
}

export async function rejectTransactionAction(id: string, note = ""): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();
  const updated = await db.transaction.updateMany({
    where: { id, status: { in: ["pending", "review"] } },
    data: { status: "failed", note: note || "Rejected by admin" },
  });
  if (updated.count === 0) return { error: t("adm.depositRejectable") };

  await logActivity(admin.id, "admin.deposit.reject", id);
  revalidatePath("/admin/transactions");
  return { ok: true };
}

/**
 * An order's timeline, fetched when the drawer opens.
 *
 * Not sent with the list: thirty orders carrying every step each would be a
 * payload nobody reads, to answer a question support asks about one of them.
 */
export async function orderStepsAction(orderId: string): Promise<{
  steps: { id: string; from: string; to: string; startCount: number; remains: number; actor: string; note: string; at: string }[];
  createdAt: string;
  error?: string;
}> {
  const t = await readerMessages();
  const user = await getCurrentUser();
  if (!user || !STAFF_ROLES.has(user.role)) return { steps: [], createdAt: "", error: t("err.supportOnly") };

  const order = await db.order.findFirst({
    where: { id: orderId },
    include: { events: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) return { steps: [], createdAt: "", error: t("err.orderGone") };

  const { locale, timezone } = await getAppContext();
  const dates = dateFormats(locale, timezone);

  return {
    createdAt: dates.full(order.createdAt),
    steps: order.events.map((e) => ({
      id: e.id,
      from: e.from,
      to: e.to,
      startCount: e.startCount,
      remains: e.remains,
      actor: e.actor,
      // Staff see the note; it is where a provider's refusal is recorded.
      note: e.note,
      at: dates.full(e.createdAt),
    })),
  };
}

/**
 * Lets a held order go.
 *
 * An abuse rule stopped it before it reached a provider, and the money it
 * would spend upstream was never spent — so approving is not just a status
 * flip on a child panel: the wholesale chain has to be bought now, at today's
 * prices, exactly as it would have been at checkout.
 *
 * Refusing is not here. That is `setOrderStatusAction(id, "canceled")`, which
 * already refunds the customer once and only once; a second path to the same
 * money is a second chance to get it wrong.
 */
export async function releaseOrderAction(id: string): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const order = await db.order.findFirst({ where: { id }, include: { service: true } });
  if (!order) return { error: t("err.orderGone") };
  if (order.status !== "held") return { error: t("adm.notHeld") };

  // Planned outside the transaction: it reads other panels and allocates
  // their ids, neither of which belongs inside one.
  const plan = await planUpstream(order.service, order.quantity);
  if ("error" in plan) {
    await logActivity(admin.id, "order.chain.blocked", plan.detail);
    return { error: plan.error };
  }

  try {
    await db.$transaction(async (tx) => {
      // Re-read inside the transaction so two admins clicking at once cannot
      // both buy the chain.
      const fresh = await tx.order.findUniqueOrThrow({ where: { id } });
      if (fresh.status !== "held") throw new Error("ALREADY_RELEASED");

      const change = { status: "pending", holdReason: "", note: "" };
      await tx.order.update({
        where: { id },
        data: {
          ...change,
          // A held order recorded the panel's own provider cost, because it
          // had no chain. Now it has one.
          ...(plan.hops.length ? { cost: plan.hops[0].charge } : {}),
        },
      });
      await recordOrderStep(tx, fresh, change, admin.username);

      await writeUpstream(tx, plan.hops, {
        downstreamOrderId: fresh.id,
        link: fresh.link,
        comments: fresh.comments,
        quantity: fresh.quantity,
        runs: fresh.runs,
        interval: fresh.interval,
        subscription: readSubscription(fresh),
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_RELEASED") return { error: t("adm.notHeld") };
    if (e instanceof Error && e.message === "UPSTREAM_FUNDS") return { error: t("err.upstreamFunds") };
    throw e;
  }

  await logActivity(admin.id, "order.release", `#${order.publicId} ${order.holdReason}`);
  revalidatePath("/admin/orders");
  return { ok: true };
}
