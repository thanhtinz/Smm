"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, logActivity } from "@/lib/auth";
import { nextPublicId } from "@/lib/ids";
import { requirePanel, runAsPanel } from "@/lib/tenancy";
import { readerMessages } from "@/lib/context";
import { LINK_TARGETS, isValidPattern, parseHosts } from "@/lib/links";
import { syncPrimaryRoutes } from "@/lib/routing";

export type ActionResult = { ok?: true; error?: string; fieldErrors?: Record<string, string> };

/** What the order form asks for: a quantity, or the comments to post. */
const SERVICE_TYPES = new Set(["default", "custom_comments", "subscription", "spread"]);

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
  revalidatePath("/dashboard/new-order");
}

// ---------------------------------------------------------------- platforms

export async function savePlatformAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { fieldErrors: { name: t("adm.nameRequired") } };

  const slug = slugify(String(form.get("slug") ?? "").trim() || name);
  if (!slug) return { fieldErrors: { slug: t("adm.slugRequired") } };

  const clash = await db.platform.findFirst({ where: { slug, ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
  if (clash) return { fieldErrors: { slug: t("adm.slugTaken") } };

  // A pattern that does not compile would be a check that silently never
  // matches, so it is refused here rather than swallowed at order time.
  const postPattern = String(form.get("postPattern") ?? "").trim();
  const profilePattern = String(form.get("profilePattern") ?? "").trim();
  if (!isValidPattern(postPattern)) return { fieldErrors: { postPattern: t("link.badPattern") } };
  if (!isValidPattern(profilePattern)) return { fieldErrors: { profilePattern: t("link.badPattern") } };

  const data = {
    name,
    slug,
    icon: String(form.get("icon") ?? "globe"),
    image: String(form.get("image") ?? "").trim(),
    color: String(form.get("color") ?? "#6366f1"),
    visible: bool(form, "visible"),
    position: num(form, "position"),
    hosts: parseHosts(String(form.get("hosts") ?? "")).join(", "),
    postPattern,
    profilePattern,
    postExample: String(form.get("postExample") ?? "").trim(),
    profileExample: String(form.get("profileExample") ?? "").trim(),
    // HTML by the panel's own admin, the same author as every other string on
    // the site — there is no untrusted author here.
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
  const t = await readerMessages();
  const admin = await requireAdmin();
  const inUse = await db.category.count({ where: { platformId: id } });
  if (inUse > 0) {
    return { error: t("adm.platformInUse", { count: inUse }) };
  }
  await db.platform.delete({ where: { id } });
  await logActivity(admin.id, "admin.platform.delete", id);
  revalidateCatalogue();
  return { ok: true };
}

// --------------------------------------------------------------- categories

export async function saveCategoryAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { fieldErrors: { name: t("adm.nameRequired") } };

  const platformId = String(form.get("platformId") ?? "").trim();
  if (!platformId) return { fieldErrors: { platformId: t("adm.choosePlatform") } };

  // The category's own address. Unique under its platform rather than across
  // the panel, so "follow" can exist under both TikTok and Instagram.
  const slug = slugify(String(form.get("slug") ?? "").trim() || name);
  if (!slug) return { fieldErrors: { slug: t("adm.slugRequired") } };

  const clash = await db.category.findFirst({
    where: { slug, platformId, ...(id ? { NOT: { id } } : {}) },
    select: { id: true },
  });
  if (clash) return { fieldErrors: { slug: t("adm.slugTaken") } };

  const data = {
    name,
    slug,
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
  const t = await readerMessages();
  const admin = await requireAdmin();
  const inUse = await db.service.count({ where: { categoryId: id } });
  if (inUse > 0) {
    return { error: t("adm.categoryInUse", { count: inUse }) };
  }
  await db.category.delete({ where: { id } });
  await logActivity(admin.id, "admin.category.delete", id);
  revalidateCatalogue();
  return { ok: true };
}

// ----------------------------------------------------------------- services

export async function saveServiceAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { fieldErrors: { name: t("adm.nameRequired") } };

  const categoryId = String(form.get("categoryId") ?? "").trim();
  if (!categoryId) return { fieldErrors: { categoryId: t("adm.chooseCategory") } };

  const rate = num(form, "rate", -1);
  if (rate < 0) return { fieldErrors: { rate: t("adm.rateRequired") } };

  const min = num(form, "min", 0);
  const max = num(form, "max", 0);
  if (min <= 0) return { fieldErrors: { min: t("adm.minPositive") } };
  if (max < min) return { fieldErrors: { max: t("adm.maxAboveMin") } };

  const providerId = String(form.get("providerId") ?? "").trim();

  // A child panel buys from the panel above it, and the form offers only that
  // panel's services. Re-checked here so a crafted request cannot point a
  // service at some other panel's catalogue.
  const panel = await requirePanel();
  const sourceServiceId = String(form.get("sourceServiceId") ?? "").trim();
  if (sourceServiceId) {
    if (!panel.parentId) return { fieldErrors: { sourceServiceId: t("adm.rootNoParent") } };
    const source = await runAsPanel(panel.parentId, () =>
      db.service.findFirst({ where: { id: sourceServiceId }, select: { id: true } }),
    );
    if (!source) return { fieldErrors: { sourceServiceId: t("adm.serviceNotParent") } };
  } else if (panel.parentId) {
    return { fieldErrors: { sourceServiceId: t("adm.chooseSource") } };
  }


  const data = {
    sourceServiceId,
    name,
    categoryId,
    providerId: providerId || null,
    providerServiceId: String(form.get("providerServiceId") ?? "").trim(),
    backupProviderId: String(form.get("backupProviderId") ?? "").trim() || null,
    backupProviderServiceId: String(form.get("backupProviderServiceId") ?? "").trim(),
    description: String(form.get("description") ?? "").trim(),
    type: SERVICE_TYPES.has(String(form.get("type"))) ? String(form.get("type")) : "default",
    target: LINK_TARGETS.includes(String(form.get("target")) as never) ? String(form.get("target")) : "post",
    rate,
    providerRate: num(form, "providerRate"),
    min: Math.round(min),
    max: Math.round(max),
    refill: bool(form, "refill"),
    cancel: bool(form, "cancel"),
    dripfeed: bool(form, "dripfeed"),
    autoPrice: bool(form, "autoPrice"),
    averageTime: String(form.get("averageTime") ?? "").trim(),
    tags: String(form.get("tags") ?? "").trim(),
    // The three figures this market quotes. Negative is meaningless and zero
    // already means "not stated", so both land on zero.
    warrantyDays: Math.max(0, num(form, "warrantyDays")),
    startMinutes: Math.max(0, num(form, "startMinutes")),
    speedPerDay: Math.max(0, num(form, "speedPerDay")),
    // A step of 1 is the same as no step, so it is stored as no step — the
    // form then shows the box empty rather than showing a rule that does
    // nothing.
    increment: Math.max(0, Math.round(num(form, "increment"))) === 1 ? 0 : Math.max(0, Math.round(num(form, "increment"))),
    overflowPercent: Math.max(0, num(form, "overflowPercent")),
    enabled: bool(form, "enabled"),
    position: num(form, "position"),
  };

  // A step the range cannot satisfy would refuse every quantity a customer
  // could type, so it is caught here rather than at the order form.
  if (data.increment > 0) {
    const first = Math.ceil(data.min / data.increment) * data.increment;
    if (first > data.max) return { fieldErrors: { increment: t("adm.incrementRange") } };
  }

  const service = id
    ? await db.service.update({ where: { id }, data })
    : await db.service.create({ data: { ...data, publicId: await nextPublicId("service") } });
  await logActivity(admin.id, id ? "admin.service.update" : "admin.service.create", name);

  // The form still edits a first choice and a backup, so saving one writes the
  // route it means. Dispatch then reads the route list and nothing else.
  await syncPrimaryRoutes(
    service.id,
    { providerId: data.providerId, providerServiceId: data.providerServiceId, cost: data.providerRate },
    { providerId: data.backupProviderId, providerServiceId: data.backupProviderServiceId },
  );

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
      return { fieldErrors: { [`tierPrice:${tier.id}`]: t("adm.priceRequired") } };
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

/**
 * Takes a service off the panel without destroying it.
 *
 * Nothing here deletes a row. Orders point at services for their history, and
 * the operator who removes the wrong one wants it back rather than an
 * explanation — so a delete marks the row and disables it, and the deleted
 * list is where it comes back from. Disabling as well as marking is what makes
 * this safe to add: every query that already reads `enabled: true` stops
 * seeing it without a line of it changing.
 */
export async function deleteServiceAction(id: string): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const service = await db.service.findUnique({ where: { id } });
  if (!service) return { error: t("adm.serviceMissing") };

  await db.service.update({ where: { id }, data: { deletedAt: new Date(), enabled: false } });
  await logActivity(admin.id, "admin.service.delete", `#${service.publicId} ${service.name}`);
  revalidateCatalogue();
  return { ok: true };
}

/** Back onto the panel, still switched off: restoring is not re-listing. */
export async function restoreServiceAction(id: string): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const service = await db.service.findUnique({ where: { id } });
  if (!service) return { error: t("adm.serviceMissing") };

  // A restored service could have been deleted because its category was, and
  // a service whose category is gone would be unreachable and unsellable.
  const category = await db.category.findUnique({ where: { id: service.categoryId } });
  if (!category) return { error: t("adm.categoryGone") };

  await db.service.update({ where: { id }, data: { deletedAt: null } });
  await logActivity(admin.id, "admin.service.restore", `#${service.publicId} ${service.name}`);
  revalidateCatalogue();
  return { ok: true };
}

/**
 * Moves many prices at once.
 *
 * `percent` shifts each service's own rate by a percentage, keeping the shape
 * of the catalogue; `set` puts every named service on one figure. A provider
 * raising its prices is the first; a promotion is the second.
 *
 * Services following their provider's price are skipped by the percentage
 * mode and reported: the next sync would overwrite whatever was written here,
 * and quietly doing work that gets undone in an hour is worse than saying so.
 */
export async function massEditRatesAction(
  serviceIds: string[],
  mode: string,
  value: number,
): Promise<ActionResult & { changed?: number; skipped?: number }> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  if (mode !== "percent" && mode !== "set") return { error: t("adm.massMode") };
  if (!Number.isFinite(value)) return { fieldErrors: { value: t("adm.rateRange") } };
  if (mode === "set" && value < 0) return { fieldErrors: { value: t("adm.rateRange") } };
  if (mode === "percent" && value <= -100) return { fieldErrors: { value: t("adm.massPercentRange") } };

  const services = await db.service.findMany({
    where: { id: { in: serviceIds }, deletedAt: null },
    select: { id: true, rate: true, autoPrice: true, publicId: true },
  });
  if (services.length === 0) return { error: t("adm.massPickServices") };

  const targets = mode === "percent" ? services.filter((s) => !s.autoPrice) : services;
  const skipped = services.length - targets.length;

  // One statement per service rather than a single updateMany: the new rate
  // depends on the old one, which SQL could express and Prisma cannot.
  await db.$transaction(
    targets.map((service) =>
      db.service.update({
        where: { id: service.id },
        data: {
          rate: mode === "set" ? value : Math.max(0, service.rate * (1 + value / 100)),
          // A hand-moved price is a pinned price. Leaving autoPrice on would
          // have the next sync undo the operator's whole afternoon.
          ...(mode === "set" ? { autoPrice: false } : {}),
        },
      }),
    ),
  );

  await logActivity(
    admin.id,
    "admin.service.massRate",
    `${mode} ${value} on ${targets.length} service(s)${skipped ? `, ${skipped} skipped` : ""}`,
  );
  revalidateCatalogue();
  return { ok: true, changed: targets.length, skipped };
}

export async function toggleServiceAction(id: string, enabled: boolean): Promise<ActionResult> {
  await requireAdmin();
  await db.service.update({ where: { id }, data: { enabled } });
  revalidateCatalogue();
  return { ok: true };
}
