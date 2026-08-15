"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, logActivity } from "@/lib/auth";
import type { ActionResult } from "./catalogue";
import { readerMessages } from "@/lib/context";

export type { ActionResult };

function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function num(form: FormData, key: string, fallback = 0) {
  const value = Number(String(form.get(key) ?? "").trim());
  return Number.isFinite(value) ? value : fallback;
}

function revalidatePricing() {
  revalidatePath("/admin/tiers");
  revalidatePath("/admin/users");
  revalidatePath("/dashboard/new-order");
}

export async function saveTierAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { fieldErrors: { name: t("adm.nameRequired") } };

  const slug = slugify(String(form.get("slug") ?? "").trim() || name);
  if (!slug) return { fieldErrors: { slug: t("adm.slugRequired") } };

  const clash = await db.userTier.findFirst({ where: { slug, ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
  if (clash) return { fieldErrors: { slug: t("adm.slugTaken") } };

  const discountPercent = num(form, "discountPercent");
  if (discountPercent < 0 || discountPercent >= 100) {
    return { fieldErrors: { discountPercent: t("adm.discountRange") } };
  }

  const isDefault = form.get("isDefault") === "on";
  const data = {
    name,
    slug,
    discountPercent,
    minSpent: Math.max(0, num(form, "minSpent")),
    color: String(form.get("color") ?? "#6366f1"),
    isDefault,
    position: num(form, "position"),
  };

  const tier = id
    ? await db.userTier.update({ where: { id }, data })
    : await db.userTier.create({ data });

  // Exactly one starting tier, or a new customer's price depends on row order.
  if (isDefault) {
    await db.userTier.updateMany({ where: { NOT: { id: tier.id } }, data: { isDefault: false } });
  }

  await logActivity(admin.id, "admin.tier.save", tier.slug);
  revalidatePricing();
  return { ok: true };
}

export async function deleteTierAction(id: string): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();
  const tier = await db.userTier.findUnique({ where: { id } });
  if (!tier) return { error: t("adm.tierMissing") };

  // Customers fall back to the spend ladder rather than losing their account.
  await db.user.updateMany({ where: { tierId: id }, data: { tierId: null } });
  await db.userTier.delete({ where: { id } });

  await logActivity(admin.id, "admin.tier.delete", tier.slug);
  revalidatePricing();
  return { ok: true };
}

/** Moves one customer onto a tier by hand, or back onto the spend ladder. */
export async function setUserTierAction(userId: string, tierId: string | null): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { error: t("adm.userMissing") };

  if (tierId) {
    const tier = await db.userTier.findUnique({ where: { id: tierId } });
    if (!tier) return { error: t("adm.tierMissing") };
  }

  await db.user.update({ where: { id: userId }, data: { tierId } });
  await logActivity(admin.id, "admin.user.tier", `${user.username} -> ${tierId ?? "auto"}`);
  revalidatePricing();
  return { ok: true };
}
