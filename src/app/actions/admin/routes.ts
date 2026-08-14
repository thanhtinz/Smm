"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, logActivity } from "@/lib/auth";
import { readerMessages } from "@/lib/context";
import type { ActionResult } from "./catalogue";

export type { ActionResult };

function revalidateRoutes() {
  revalidatePath("/admin/services");
}

/**
 * Adds a provider that can also fulfil a service, or edits one already there.
 * The first choice and the backup are written by the service form itself, so
 * they turn up in the same list without being editable twice.
 */
export async function saveRouteAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const serviceId = String(form.get("serviceId") ?? "");
  const providerId = String(form.get("providerId") ?? "");
  const providerServiceId = String(form.get("providerServiceId") ?? "").trim();

  const service = await db.service.findFirst({ where: { id: serviceId }, select: { id: true, name: true } });
  if (!service) return { error: t("adm.serviceMissing") };
  if (!providerId) return { fieldErrors: { providerId: t("adm.chooseProvider") } };

  const provider = await db.provider.findFirst({ where: { id: providerId }, select: { id: true, name: true } });
  if (!provider) return { error: t("adm.providerMissing") };
  if (!providerServiceId) return { fieldErrors: { providerServiceId: t("adm.providerServiceRequired") } };

  const cost = Number(String(form.get("cost") ?? "").trim()) || 0;
  if (cost < 0) return { fieldErrors: { cost: t("adm.abovezero") } };

  const existing = await db.serviceRoute.findFirst({ where: { serviceId, providerId } });
  if (existing) {
    await db.serviceRoute.update({
      where: { id: existing.id },
      data: { providerServiceId, cost, enabled: form.get("enabled") === "on" },
    });
  } else {
    await db.serviceRoute.create({
      data: { serviceId, providerId, providerServiceId, cost, enabled: form.get("enabled") === "on" },
    });
  }

  await logActivity(admin.id, "admin.route.save", `${service.name} -> ${provider.name}`);
  revalidateRoutes();
  return { ok: true };
}

export async function deleteRouteAction(id: string): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();
  const row = await db.serviceRoute.findFirst({
    where: { id },
    include: { service: { select: { name: true } }, provider: { select: { name: true } } },
  });
  if (!row) return { error: t("adm.routeMissing") };

  await db.serviceRoute.delete({ where: { id } });
  await logActivity(admin.id, "admin.route.delete", `${row.service.name} -> ${row.provider.name}`);
  revalidateRoutes();
  return { ok: true };
}

export async function setRouteEnabledAction(id: string, enabled: boolean): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();
  const row = await db.serviceRoute.findFirst({ where: { id }, include: { provider: { select: { name: true } } } });
  if (!row) return { error: t("adm.routeMissing") };

  await db.serviceRoute.update({ where: { id }, data: { enabled } });
  await logActivity(admin.id, "admin.route.toggle", `${row.provider.name} ${enabled ? "on" : "off"}`);
  revalidateRoutes();
  return { ok: true };
}
