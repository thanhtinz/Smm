"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, logActivity } from "@/lib/auth";
import { nextPublicId } from "@/lib/ids";
import { creditDeposit } from "@/lib/payments/credit";
import { ORDER_STATUSES } from "@/lib/orders";
import type { ActionResult } from "./catalogue";

export type { ActionResult };

/** Statuses that hand the customer's money back. */
const REFUNDING = new Set(["canceled", "refunded"]);

/**
 * Moves an order between statuses and settles the money exactly once.
 * Re-reads the order inside the transaction so two admins clicking at the
 * same time cannot both issue a refund.
 */
export async function setOrderStatusAction(id: string, status: string, note = ""): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!ORDER_STATUSES.includes(status as never)) return { error: "Unknown status" };

  // Ids come from the counter table on its own connection, so they are
  // allocated before the transaction opens rather than inside it.
  const refundPublicId = REFUNDING.has(status) ? await nextPublicId("transaction") : 0;

  try {
    await db.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({ where: { id }, include: { service: true } });
      if (order.status === status) return;

      const wasRefunded = REFUNDING.has(order.status);
      const willRefund = REFUNDING.has(status);

      await tx.order.update({
        where: { id },
        data: {
          status,
          note: note || order.note,
          ...(status === "completed" ? { remains: 0 } : {}),
        },
      });

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
          data: {
            userId: order.userId,
            title: `Order #${order.publicId} refunded`,
            body: order.service.name,
            level: "warning",
            href: "/dashboard/orders",
          },
        });
      }
    });
  } catch {
    return { error: "That order could not be updated." };
  }

  await logActivity(admin.id, "admin.order.status", `${id} -> ${status}`);
  revalidatePath("/admin/orders");
  revalidatePath("/dashboard/orders");
  return { ok: true };
}

// -------------------------------------------------------------------- users

export async function adjustBalanceAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const userId = String(form.get("userId") ?? "");
  const amount = Number(String(form.get("amount") ?? "").trim());
  const note = String(form.get("note") ?? "").trim();

  if (!Number.isFinite(amount) || amount === 0) {
    return { fieldErrors: { amount: "Enter a non-zero amount" } };
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
        data: {
          userId,
          title: amount > 0 ? "Balance added" : "Balance adjusted",
          body: note || "An administrator adjusted your balance.",
          level: amount > 0 ? "success" : "warning",
          href: "/dashboard/transactions",
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "NEGATIVE") {
      return { fieldErrors: { amount: "That would take the balance below zero" } };
    }
    return { error: "The balance could not be adjusted." };
  }

  await logActivity(admin.id, "admin.balance.adjust", `${userId} ${amount}`);
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserRoleAction(userId: string, role: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!["user", "support", "admin"].includes(role)) return { error: "Unknown role" };

  if (userId === admin.id && role !== "admin") {
    return { error: "You cannot remove your own admin role." };
  }

  await db.user.update({ where: { id: userId }, data: { role } });
  await logActivity(admin.id, "admin.user.role", `${userId} -> ${role}`);
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserBanAction(userId: string, banned: boolean, reason = ""): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (userId === admin.id) return { error: "You cannot suspend your own account." };

  await db.user.update({ where: { id: userId }, data: { banned, banReason: banned ? reason : "" } });
  // A suspended user keeps no live sessions.
  if (banned) await db.session.deleteMany({ where: { userId } });

  await logActivity(admin.id, banned ? "admin.user.ban" : "admin.user.unban", userId);
  revalidatePath("/admin/users");
  return { ok: true };
}

// ------------------------------------------------------------- transactions

export async function approveTransactionAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const result = await creditDeposit(id);
  if (result === "missing") return { error: "That deposit no longer exists." };

  await logActivity(admin.id, "admin.deposit.approve", id);
  revalidatePath("/admin/transactions");
  return { ok: true };
}

export async function rejectTransactionAction(id: string, note = ""): Promise<ActionResult> {
  const admin = await requireAdmin();
  const updated = await db.transaction.updateMany({
    where: { id, status: "pending" },
    data: { status: "failed", note: note || "Rejected by admin" },
  });
  if (updated.count === 0) return { error: "Only a pending deposit can be rejected." };

  await logActivity(admin.id, "admin.deposit.reject", id);
  revalidatePath("/admin/transactions");
  return { ok: true };
}
