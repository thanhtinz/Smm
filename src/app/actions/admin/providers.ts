"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, logActivity } from "@/lib/auth";
import { nextPublicId } from "@/lib/ids";
import { currentPanelId } from "@/lib/tenancy";
import { dispatchPendingOrders, fetchProviderBalance, fetchProviderServices, syncOrderStatuses } from "@/lib/providers";
import type { ActionResult } from "./catalogue";

export type { ActionResult };

export type SyncResult = ActionResult & { message?: string };

export async function saveProviderAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { fieldErrors: { name: "Enter a name" } };

  const apiUrl = String(form.get("apiUrl") ?? "").trim();
  try {
    const parsed = new URL(apiUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("scheme");
  } catch {
    return { fieldErrors: { apiUrl: "Enter the full API URL, including https://" } };
  }

  const apiKey = String(form.get("apiKey") ?? "").trim();
  // Blank means "keep the stored key" so other fields can be edited safely.
  if (!id && !apiKey) return { fieldErrors: { apiKey: "Enter the API key" } };

  const data = {
    name,
    apiUrl,
    currency: String(form.get("currency") ?? "USD").trim().toUpperCase() || "USD",
    enabled: form.get("enabled") === "on",
    ...(apiKey ? { apiKey } : {}),
  };

  if (id) await db.provider.update({ where: { id }, data });
  else await db.provider.create({ data: { ...data, apiKey } });

  await logActivity(admin.id, "admin.provider.save", name);
  revalidatePath("/admin/providers");
  return { ok: true };
}

export async function deleteProviderAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const inUse = await db.service.count({ where: { providerId: id } });
  if (inUse > 0) {
    return { error: `${inUse} service${inUse === 1 ? " is" : "s are"} mapped to this provider. Unmap them first.` };
  }
  await db.provider.delete({ where: { id } });
  await logActivity(admin.id, "admin.provider.delete", id);
  revalidatePath("/admin/providers");
  return { ok: true };
}

/** Reads the upstream balance so an operator can see funds before dispatching. */
export async function refreshProviderBalanceAction(id: string): Promise<SyncResult> {
  await requireAdmin();
  const provider = await db.provider.findUnique({ where: { id } });
  if (!provider) return { error: "Provider not found" };

  const result = await fetchProviderBalance(provider);
  if (!result.ok) return { error: result.error };

  await db.provider.update({
    where: { id },
    data: { balance: Number(result.data.balance) || 0, currency: result.data.currency || provider.currency, lastSyncAt: new Date() },
  });
  revalidatePath("/admin/providers");
  return { ok: true, message: `${result.data.balance} ${result.data.currency}` };
}

/**
 * Imports the provider's catalogue. Existing mappings are updated in place;
 * new services land disabled with a markup applied, so nothing goes on sale
 * before an operator has looked at it.
 */
export async function importProviderServicesAction(id: string, markupPercent: number): Promise<SyncResult> {
  const admin = await requireAdmin();
  const provider = await db.provider.findUnique({ where: { id } });
  if (!provider) return { error: "Provider not found" };

  const result = await fetchProviderServices(provider);
  if (!result.ok) return { error: result.error };
  if (!Array.isArray(result.data)) return { error: "Provider did not return a service list" };

  const markup = 1 + (Number.isFinite(markupPercent) ? markupPercent : 0) / 100;

  // Everything imported from one provider lands under a single platform and
  // per-provider-category buckets, which an operator can then reorganise.
  const platformSlug = `provider-${provider.id.slice(0, 8)}`;
  const platform = await db.platform.upsert({
    where: { panelId_slug: { panelId: await currentPanelId(), slug: platformSlug } },
    create: { slug: platformSlug, name: provider.name, icon: "server", visible: false, position: 99 },
    update: {},
  });

  const existing = await db.service.findMany({
    where: { providerId: provider.id },
    select: { id: true, providerServiceId: true },
  });
  const known = new Map(existing.map((s) => [s.providerServiceId, s.id]));

  let created = 0;
  let updated = 0;

  for (const row of result.data.slice(0, 2000)) {
    const providerServiceId = String(row.service ?? "").trim();
    if (!providerServiceId) continue;

    const providerRate = Number(row.rate) || 0;
    const min = Math.max(1, Number(row.min) || 1);
    const max = Math.max(min, Number(row.max) || min);
    const name = String(row.name ?? providerServiceId).slice(0, 250);

    const known_id = known.get(providerServiceId);
    if (known_id) {
      // Only upstream-owned fields are refreshed; the operator's own price
      // and visibility choices survive a re-import.
      await db.service.update({
        where: { id: known_id },
        data: { providerRate, min, max, refill: Boolean(row.refill), cancel: Boolean(row.cancel), dripfeed: Boolean(row.dripfeed) },
      });
      updated += 1;
      continue;
    }

    const categoryName = String(row.category ?? "Imported").slice(0, 120);
    const category =
      (await db.category.findFirst({ where: { name: categoryName, platformId: platform.id } })) ??
      (await db.category.create({ data: { name: categoryName, platformId: platform.id, visible: false } }));

    await db.service.create({
      data: {
        publicId: await nextPublicId("service"),
        categoryId: category.id,
        providerId: provider.id,
        providerServiceId,
        name,
        rate: Math.round(providerRate * markup),
        providerRate,
        min,
        max,
        refill: Boolean(row.refill),
        cancel: Boolean(row.cancel),
        dripfeed: Boolean(row.dripfeed),
        enabled: false,
      },
    });
    created += 1;
  }

  await db.provider.update({ where: { id }, data: { lastSyncAt: new Date() } });
  await logActivity(admin.id, "admin.provider.import", `${provider.name}: +${created} ~${updated}`);
  revalidatePath("/admin/providers");
  revalidatePath("/admin/services");
  return { ok: true, message: `${created} new, ${updated} updated` };
}

export async function dispatchOrdersAction(): Promise<SyncResult> {
  const admin = await requireAdmin();
  const { sent, failures } = await dispatchPendingOrders();
  await logActivity(admin.id, "admin.provider.dispatch", `${sent} sent`);
  revalidatePath("/admin/orders");
  return { ok: true, message: `${sent} sent${failures.length ? `, ${failures.length} failed` : ""}` };
}

export async function syncStatusesAction(): Promise<SyncResult> {
  const admin = await requireAdmin();
  const { updated, failures } = await syncOrderStatuses();
  await logActivity(admin.id, "admin.provider.sync", `${updated} updated`);
  revalidatePath("/admin/orders");
  return { ok: true, message: `${updated} updated${failures.length ? `, ${failures.length} failed` : ""}` };
}
