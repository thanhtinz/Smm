"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, logActivity } from "@/lib/auth";
import type { ActionResult } from "./catalogue";

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
  revalidatePath("/services");
  revalidatePath("/dashboard/new-order");
}

export async function saveTierAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { fieldErrors: { name: "Enter a name" } };

  const slug = slugify(String(form.get("slug") ?? "").trim() || name);
  if (!slug) return { fieldErrors: { slug: "Enter a slug" } };

  const clash = await db.userTier.findFirst({ where: { slug, ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
  if (clash) return { fieldErrors: { slug: "That slug is already used" } };

  const discountPercent = num(form, "discountPercent");
  if (discountPercent < 0 || discountPercent >= 100) {
    return { fieldErrors: { discountPercent: "Use a discount between 0 and 99" } };
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
  const admin = await requireAdmin();
  const tier = await db.userTier.findUnique({ where: { id } });
  if (!tier) return { error: "Tier not found" };

  // Customers fall back to the spend ladder rather than losing their account.
  await db.user.updateMany({ where: { tierId: id }, data: { tierId: null } });
  await db.userTier.delete({ where: { id } });

  await logActivity(admin.id, "admin.tier.delete", tier.slug);
  revalidatePricing();
  return { ok: true };
}

/**
 * Stores a hand-set price for one service in one tier, or clears it so the
 * tier percentage applies again.
 */
export async function setTierPriceAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const tierId = String(form.get("tierId") ?? "");
  const serviceId = String(form.get("serviceId") ?? "");
  const [tier, service] = await Promise.all([
    db.userTier.findUnique({ where: { id: tierId } }),
    db.service.findUnique({ where: { id: serviceId } }),
  ]);
  if (!tier || !service) return { error: "Tier or service not found" };

  const raw = String(form.get("rate") ?? "").trim();
  if (raw === "") {
    await db.tierPrice.deleteMany({ where: { tierId, serviceId } });
    await logActivity(admin.id, "admin.tier.price.clear", `${tier.slug} ${service.publicId}`);
    revalidatePricing();
    return { ok: true };
  }

  const rate = Number(raw);
  if (!Number.isFinite(rate) || rate < 0) return { fieldErrors: { rate: "Enter a price" } };

  await db.tierPrice.upsert({
    where: { tierId_serviceId: { tierId, serviceId } },
    create: { tierId, serviceId, rate },
    update: { rate },
  });

  await logActivity(admin.id, "admin.tier.price", `${tier.slug} ${service.publicId} = ${rate}`);
  revalidatePricing();
  return { ok: true };
}

/** Moves one customer onto a tier by hand, or back onto the spend ladder. */
export async function setUserTierAction(userId: string, tierId: string | null): Promise<ActionResult> {
  const admin = await requireAdmin();
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "User not found" };

  if (tierId) {
    const tier = await db.userTier.findUnique({ where: { id: tierId } });
    if (!tier) return { error: "Tier not found" };
  }

  await db.user.update({ where: { id: userId }, data: { tierId } });
  await logActivity(admin.id, "admin.user.tier", `${user.username} -> ${tierId ?? "auto"}`);
  revalidatePricing();
  return { ok: true };
}
