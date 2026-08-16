"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRootAdmin, logActivity } from "@/lib/auth";
import { dispatchPendingOrders, fetchProviderBalance, providerLabel, syncOrderStatuses } from "@/lib/providers";
import { syncProviderCatalogue, type SyncReport } from "@/lib/provider-sync";
import type { ActionResult } from "./catalogue";
import { readerMessages } from "@/lib/context";

export type { ActionResult };

export type SyncResult = ActionResult & { message?: string };

export async function saveProviderAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireRootAdmin();

  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { fieldErrors: { name: t("adm.nameRequired") } };

  const apiUrl = String(form.get("apiUrl") ?? "").trim();
  try {
    const parsed = new URL(apiUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("scheme");
  } catch {
    return { fieldErrors: { apiUrl: t("adm.apiUrlRequired") } };
  }

  const apiKey = String(form.get("apiKey") ?? "").trim();
  // Blank means "keep the stored key" so other fields can be edited safely.
  if (!id && !apiKey) return { fieldErrors: { apiKey: t("adm.apiKeyRequired") } };

  const number = (key: string, fallback: number) => {
    const value = Number(String(form.get(key) ?? "").trim());
    return Number.isFinite(value) ? value : fallback;
  };

  const data = {
    name,
    alias: String(form.get("alias") ?? "").trim(),
    apiUrl,
    currency: String(form.get("currency") ?? "USD").trim().toUpperCase() || "USD",
    enabled: form.get("enabled") === "on",
    autoSync: form.get("autoSync") === "on",
    syncEveryHours: Math.max(1, Math.round(number("syncEveryHours", 12))),
    markupPercent: number("markupPercent", 60),
    alertPercent: Math.max(0, number("alertPercent", 25)),
    lowBalance: Math.max(0, number("lowBalance", 0)),
    ...(apiKey ? { apiKey } : {}),
  };

  if (id) await db.provider.update({ where: { id }, data });
  else await db.provider.create({ data: { ...data, apiKey } });

  await logActivity(admin.id, "admin.provider.save", name);
  revalidatePath("/admin/providers");
  return { ok: true };
}

export async function deleteProviderAction(id: string): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireRootAdmin();
  const inUse = await db.service.count({ where: { providerId: id } });
  if (inUse > 0) {
    return { error: t("adm.providerInUse", { count: inUse }) };
  }
  await db.provider.delete({ where: { id } });
  await logActivity(admin.id, "admin.provider.delete", id);
  revalidatePath("/admin/providers");
  return { ok: true };
}

/** Reads the upstream balance so an operator can see funds before dispatching. */
export async function refreshProviderBalanceAction(id: string): Promise<SyncResult> {
  const t = await readerMessages();
  await requireRootAdmin();
  const provider = await db.provider.findUnique({ where: { id } });
  if (!provider) return { error: t("adm.providerMissing") };

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
 * The manual pull, from the admin area. Same engine as the scheduled run,
 * with new services turned on: asking for an import is asking for the rows.
 */
export async function importProviderServicesAction(id: string): Promise<SyncResult> {
  const t = await readerMessages();
  const admin = await requireRootAdmin();
  const provider = await db.provider.findUnique({ where: { id } });
  if (!provider) return { error: t("adm.providerMissing") };

  const report = await syncProviderCatalogue(provider, { importNew: true });
  if (report.fault) return { error: t(report.fault.key, report.fault.vars) };

  await logActivity(
    admin.id,
    "admin.provider.import",
    `${providerLabel(provider)}: +${report.created} ~${report.updated} price ${report.repriced}`,
  );
  revalidatePath("/admin/providers");
  revalidatePath("/admin/services");
  return { ok: true, message: summarise(report) };
}

/** Refreshes prices without taking on anything new. */
export async function syncProviderPricesAction(id: string): Promise<SyncResult> {
  const t = await readerMessages();
  const admin = await requireRootAdmin();
  const provider = await db.provider.findUnique({ where: { id } });
  if (!provider) return { error: t("adm.providerMissing") };

  const report = await syncProviderCatalogue(provider);
  if (report.fault) return { error: t(report.fault.key, report.fault.vars) };

  await logActivity(admin.id, "admin.provider.sync.prices", `${providerLabel(provider)}: ${report.repriced} repriced`);
  revalidatePath("/admin/providers");
  revalidatePath("/admin/services");
  return { ok: true, message: summarise(report) };
}

function summarise(report: SyncReport): string {
  const parts = [
    report.created ? `${report.created} new` : "",
    `${report.updated} checked`,
    report.repriced ? `${report.repriced} repriced` : "",
    report.missing ? `${report.missing} delisted` : "",
    report.returned ? `${report.returned} back` : "",
    report.alerts.length ? `${report.alerts.length} to review` : "",
  ];
  return parts.filter(Boolean).join(", ");
}

export async function dispatchOrdersAction(): Promise<SyncResult> {
  const t = await readerMessages();
  const admin = await requireRootAdmin();
  const { sent, failures } = await dispatchPendingOrders();
  await logActivity(admin.id, "admin.provider.dispatch", `${sent} sent`);
  revalidatePath("/admin/orders");
  return { ok: true, message: failures.length ? t("adm.dispatchedFailed", { sent, failed: failures.length }) : t("adm.dispatched", { sent }) };
}

export async function syncStatusesAction(): Promise<SyncResult> {
  const t = await readerMessages();
  const admin = await requireRootAdmin();
  const { updated, failures } = await syncOrderStatuses();
  await logActivity(admin.id, "admin.provider.sync", `${updated} updated`);
  revalidatePath("/admin/orders");
  return { ok: true, message: failures.length ? t("adm.syncedFailed", { updated, failed: failures.length }) : t("adm.synced", { updated }) };
}
