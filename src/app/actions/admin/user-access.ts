"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, logActivity } from "@/lib/auth";
import { readerMessages } from "@/lib/context";
import { isAccessRule, serialiseAccessRules, type AccessRule } from "@/lib/access";
import type { ActionResult } from "./catalogue";

export type { ActionResult };

/**
 * What one customer pays and what one customer may do.
 *
 * Tiers and roles handle the general case; this file is the exception to it.
 * Everything here is per account, and everything here is logged — a price
 * quietly moved for one reseller is exactly the change an operator will want
 * to find again six months later.
 */

function revalidateUser(userId: string) {
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  // The customer's own pages quote prices, and the deposit page lists the
  // methods they may use.
  revalidatePath("/dashboard/new-order");
  revalidatePath("/dashboard/wallet");
}

/** A percentage off everything, on top of whatever their tier gives them. */
export async function setUserDiscountAction(userId: string, percent: number): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { error: t("adm.userMissing") };

  if (!Number.isFinite(percent) || percent < 0 || percent >= 100) {
    return { fieldErrors: { discountPercent: t("adm.discountRange") } };
  }

  await db.user.update({ where: { id: userId }, data: { discountPercent: percent } });
  await logActivity(admin.id, "admin.user.discount", `${user.username} -> ${percent}%`);
  revalidateUser(userId);
  return { ok: true };
}

/**
 * One service, priced for one customer. A blank rate clears the override
 * rather than setting it to zero — "no special price" and "free" are different
 * answers, and a form with one empty box has to mean the first.
 */
export async function setUserRateAction(
  userId: string,
  serviceId: string,
  rate: number | null,
): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const [user, service] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.service.findUnique({ where: { id: serviceId } }),
  ]);
  if (!user) return { error: t("adm.userMissing") };
  if (!service) return { error: t("adm.serviceMissing") };

  if (rate === null) {
    await db.userServiceRate.deleteMany({ where: { userId, serviceId } });
    await logActivity(admin.id, "admin.user.rate.clear", `${user.username} #${service.publicId}`);
  } else {
    if (!Number.isFinite(rate) || rate < 0) return { fieldErrors: { rate: t("adm.rateRange") } };

    // upsert rather than create-or-update by hand: the unique key is
    // (user, service), and two admins saving the same row is a 500 otherwise.
    await db.userServiceRate.upsert({
      where: { userId_serviceId: { userId, serviceId } },
      create: { userId, serviceId, rate },
      update: { rate },
    });
    await logActivity(admin.id, "admin.user.rate.set", `${user.username} #${service.publicId} -> ${rate}`);
  }

  revalidateUser(userId);
  return { ok: true };
}

/**
 * Copies one customer's whole rate card onto others.
 *
 * The usual reason a per-user price exists at all is a deal offered to a group
 * of resellers, and setting eighty rates by hand eighty times is how three of
 * them end up on the wrong one. Replaces the targets' overrides rather than
 * merging: half of one deal and half of another is a price nobody agreed to.
 */
export async function copyUserRatesAction(fromUserId: string, usernames: string[]): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const source = await db.user.findUnique({ where: { id: fromUserId } });
  if (!source) return { error: t("adm.userMissing") };

  const wanted = [...new Set(usernames.map((name) => name.trim()).filter(Boolean))];
  if (wanted.length === 0) return { error: t("adm.pickUsers") };

  // By username, because that is what an operator has in front of them.
  // Filtered through the panel-scoped client, so a name that exists on
  // another tenant simply is not found here.
  const found = await db.user.findMany({
    where: { username: { in: wanted } },
    select: { id: true, username: true },
  });

  // Named and not found is reported rather than skipped: silently copying to
  // four of the five accounts an operator typed is the failure they will not
  // notice until a customer is on the wrong price.
  const missing = wanted.filter((name) => !found.some((u) => u.username === name));
  if (missing.length > 0) return { error: t("access.unknownUsers", { names: missing.join(", ") }) };

  const targets = found.filter((u) => u.id !== fromUserId);
  if (targets.length === 0) return { error: t("adm.pickUsers") };

  const rates = await db.userServiceRate.findMany({
    where: { userId: fromUserId },
    select: { serviceId: true, rate: true },
  });

  const targetIds = targets.map((u) => u.id);
  await db.$transaction([
    db.userServiceRate.deleteMany({ where: { userId: { in: targetIds } } }),
    ...(rates.length > 0
      ? [
          db.userServiceRate.createMany({
            data: targetIds.flatMap((id) => rates.map((r) => ({ userId: id, serviceId: r.serviceId, rate: r.rate }))),
          }),
        ]
      : []),
  ]);

  await logActivity(
    admin.id,
    "admin.user.rate.copy",
    `${source.username} -> ${targets.map((u) => u.username).join(", ")} (${rates.length})`,
  );
  for (const id of targetIds) revalidateUser(id);
  return { ok: true };
}

/**
 * Drops every custom rate on the named accounts, putting them back on their
 * tier. Takes a list because the reason to do it — a promotion ending — ends
 * for everyone at once.
 */
export async function resetUserRatesAction(userIds: string[]): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true } });
  if (users.length === 0) return { error: t("adm.pickUsers") };

  const { count } = await db.userServiceRate.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
  await logActivity(admin.id, "admin.user.rate.reset", `${users.map((u) => u.username).join(", ")} (${count})`);
  for (const user of users) revalidateUser(user.id);
  return { ok: true };
}

/** The things this account may not do. Everything absent is allowed. */
export async function setUserAccessRulesAction(userId: string, denied: string[]): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { error: t("adm.userMissing") };

  // Unknown names are dropped rather than stored: a rule this build does not
  // know is a rule nothing will ever check, and keeping it would show an
  // operator a restriction that is not in force.
  const rules = denied.filter((name): name is AccessRule => isAccessRule(name));

  await db.user.update({ where: { id: userId }, data: { accessRules: serialiseAccessRules(rules) } });
  await logActivity(admin.id, "admin.user.access", `${user.username} -> ${rules.join(",") || "all"}`);
  revalidateUser(userId);
  return { ok: true };
}

/** Which deposit methods this account is offered. Empty is all of them. */
export async function setUserPaymentMethodsAction(userId: string, methodIds: string[]): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { error: t("adm.userMissing") };

  const methods = await db.paymentMethod.findMany({
    where: { id: { in: methodIds } },
    select: { id: true, code: true },
  });

  await db.user.update({
    where: { id: userId },
    data: { allowedPaymentMethods: JSON.stringify(methods.map((m) => m.id)) },
  });
  await logActivity(
    admin.id,
    "admin.user.methods",
    `${user.username} -> ${methods.map((m) => m.code).join(",") || "all"}`,
  );
  revalidateUser(userId);
  return { ok: true };
}
