"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, logActivity } from "@/lib/auth";
import { nextPublicId } from "@/lib/ids";
import { requirePanel, runAsPanel } from "@/lib/tenancy";

export type ActionResult = { ok?: true; error?: string; fieldErrors?: Record<string, string> };

/** What the order form asks for: a quantity, or the comments to post. */
const SERVICE_TYPES = new Set(["default", "custom_comments"]);

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

function bool(form: FormData, key: string) {
  return form.get(key) === "on" || form.get(key) === "true";
}

function revalidateCatalogue() {
  revalidatePath("/admin/platforms");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/services");
  revalidatePath("/services");
  revalidatePath("/dashboard/new-order");
}

// ---------------------------------------------------------------- platforms

export async function savePlatformAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { fieldErrors: { name: "Enter a name" } };

  const slug = slugify(String(form.get("slug") ?? "").trim() || name);
  if (!slug) return { fieldErrors: { slug: "Enter a slug" } };

  const clash = await db.platform.findFirst({ where: { slug, ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
  if (clash) return { fieldErrors: { slug: "That slug is already used" } };

  const data = {
    name,
    slug,
    icon: String(form.get("icon") ?? "globe"),
    image: String(form.get("image") ?? "").trim(),
    color: String(form.get("color") ?? "#6366f1"),
    visible: bool(form, "visible"),
    position: num(form, "position"),
  };

  if (id) {
    await db.platform.update({ where: { id }, data });
    await logActivity(admin.id, "admin.platform.update", name);
  } else {
    await db.platform.create({ data });
    await logActivity(admin.id, "admin.platform.create", name);
  }

  revalidateCatalogue();
  return { ok: true };
}

export async function deletePlatformAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const inUse = await db.category.count({ where: { platformId: id } });
  if (inUse > 0) {
    return { error: `This platform still has ${inUse} categor${inUse === 1 ? "y" : "ies"}. Move or delete them first.` };
  }
  await db.platform.delete({ where: { id } });
  await logActivity(admin.id, "admin.platform.delete", id);
  revalidateCatalogue();
  return { ok: true };
}

// --------------------------------------------------------------- categories

export async function saveCategoryAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { fieldErrors: { name: "Enter a name" } };

  const platformId = String(form.get("platformId") ?? "").trim();
  if (!platformId) return { fieldErrors: { platformId: "Choose a platform" } };

  const data = {
    name,
    platformId,
    description: String(form.get("description") ?? "").trim(),
    visible: bool(form, "visible"),
    position: num(form, "position"),
  };

  if (id) {
    await db.category.update({ where: { id }, data });
    await logActivity(admin.id, "admin.category.update", name);
  } else {
    await db.category.create({ data });
    await logActivity(admin.id, "admin.category.create", name);
  }

  revalidateCatalogue();
  return { ok: true };
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const inUse = await db.service.count({ where: { categoryId: id } });
  if (inUse > 0) {
    return { error: `This category still has ${inUse} service${inUse === 1 ? "" : "s"}. Move or delete them first.` };
  }
  await db.category.delete({ where: { id } });
  await logActivity(admin.id, "admin.category.delete", id);
  revalidateCatalogue();
  return { ok: true };
}

// ----------------------------------------------------------------- services

export async function saveServiceAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { fieldErrors: { name: "Enter a name" } };

  const categoryId = String(form.get("categoryId") ?? "").trim();
  if (!categoryId) return { fieldErrors: { categoryId: "Choose a category" } };

  const rate = num(form, "rate", -1);
  if (rate < 0) return { fieldErrors: { rate: "Enter a rate per 1000" } };

  const min = num(form, "min", 0);
  const max = num(form, "max", 0);
  if (min <= 0) return { fieldErrors: { min: "Minimum must be greater than zero" } };
  if (max < min) return { fieldErrors: { max: "Maximum must be at least the minimum" } };

  const providerId = String(form.get("providerId") ?? "").trim();

  // A child panel buys from the panel above it, and the form offers only that
  // panel's services. Re-checked here so a crafted request cannot point a
  // service at some other panel's catalogue.
  const panel = await requirePanel();
  const sourceServiceId = String(form.get("sourceServiceId") ?? "").trim();
  if (sourceServiceId) {
    if (!panel.parentId) return { fieldErrors: { sourceServiceId: "The root panel has no panel to buy from" } };
    const source = await runAsPanel(panel.parentId, () =>
      db.service.findFirst({ where: { id: sourceServiceId }, select: { id: true } }),
    );
    if (!source) return { fieldErrors: { sourceServiceId: "That service is not on the parent panel" } };
  } else if (panel.parentId) {
    return { fieldErrors: { sourceServiceId: "Choose the service this is bought from" } };
  }

  const data = {
    sourceServiceId,
    name,
    categoryId,
    providerId: providerId || null,
    providerServiceId: String(form.get("providerServiceId") ?? "").trim(),
    description: String(form.get("description") ?? "").trim(),
    type: SERVICE_TYPES.has(String(form.get("type"))) ? String(form.get("type")) : "default",
    rate,
    providerRate: num(form, "providerRate"),
    min: Math.round(min),
    max: Math.round(max),
    refill: bool(form, "refill"),
    cancel: bool(form, "cancel"),
    dripfeed: bool(form, "dripfeed"),
    averageTime: String(form.get("averageTime") ?? "").trim(),
    enabled: bool(form, "enabled"),
    position: num(form, "position"),
  };

  const service = id
    ? await db.service.update({ where: { id }, data })
    : await db.service.create({ data: { ...data, publicId: await nextPublicId("service") } });
  await logActivity(admin.id, id ? "admin.service.update" : "admin.service.create", name);

  // Per-tier prices are edited alongside the price they override, so they are
  // saved with the service rather than from a separate screen. A blank field
  // clears the override and hands the service back to the tier percentage.
  const tiers = await db.userTier.findMany({ select: { id: true } });
  for (const tier of tiers) {
    const raw = String(form.get(`tierPrice:${tier.id}`) ?? "").trim();
    if (raw === "") {
      await db.tierPrice.deleteMany({ where: { tierId: tier.id, serviceId: service.id } });
      continue;
    }
    const tierRate = Number(raw);
    if (!Number.isFinite(tierRate) || tierRate < 0) {
      return { fieldErrors: { [`tierPrice:${tier.id}`]: "Enter a price" } };
    }
    await db.tierPrice.upsert({
      where: { tierId_serviceId: { tierId: tier.id, serviceId: service.id } },
      create: { tierId: tier.id, serviceId: service.id, rate: tierRate },
      update: { rate: tierRate },
    });
  }

  revalidateCatalogue();
  revalidatePath("/admin/tiers");
  return { ok: true };
}

export async function deleteServiceAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const inUse = await db.order.count({ where: { serviceId: id } });
  if (inUse > 0) {
    // Orders reference the service for their history, so retire rather than delete.
    await db.service.update({ where: { id }, data: { enabled: false } });
    await logActivity(admin.id, "admin.service.disable", id);
    revalidateCatalogue();
    return { error: `This service has ${inUse} order${inUse === 1 ? "" : "s"} against it, so it was disabled instead of deleted.` };
  }
  await db.service.delete({ where: { id } });
  await logActivity(admin.id, "admin.service.delete", id);
  revalidateCatalogue();
  return { ok: true };
}

export async function toggleServiceAction(id: string, enabled: boolean): Promise<ActionResult> {
  await requireAdmin();
  await db.service.update({ where: { id }, data: { enabled } });
  revalidateCatalogue();
  return { ok: true };
}
