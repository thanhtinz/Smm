"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser, requireAdmin, logActivity } from "@/lib/auth";
import { readerMessages } from "@/lib/context";
import { getCurrentPanel } from "@/lib/tenancy";
import {
  openPanelRequest,
  refreshDelegation,
  approvePanelRequest,
  rejectPanelRequest,
} from "@/lib/panel-requests";

export type PanelRequestState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: true;
  /** The nameservers to set at the registrar, once there are any. */
  nameServers?: string[];
};

/** A customer asking this panel for one of their own. */
export async function requestPanelAction(
  _prev: PanelRequestState,
  form: FormData,
): Promise<PanelRequestState> {
  const t = await readerMessages();
  const user = await getCurrentUser();
  if (!user) return { error: t("err.sessionShort") };

  const parent = await getCurrentPanel();
  if (!parent) return { error: t("err.orderDisabled") };

  const outcome = await openPanelRequest(parent, user.id, {
    name: String(form.get("name") ?? ""),
    slug: String(form.get("slug") ?? ""),
    host: String(form.get("host") ?? ""),
  });
  if ("key" in outcome) return { error: t(outcome.key, outcome.vars) };

  await logActivity(user.id, "panel.request", `#${outcome.publicId} ${String(form.get("host") ?? "")}`);
  revalidatePath("/dashboard/panel");
  revalidatePath("/admin/panels");
  return { ok: true, nameServers: outcome.nameServers };
}

/**
 * Re-reads the delegation.
 *
 * Open to the customer whose request it is as well as to an admin: they are
 * the one who just changed the nameservers, and making them wait for staff to
 * press a button would be the whole point of the flow undone.
 */
export async function refreshDelegationAction(requestId: string): Promise<PanelRequestState> {
  const t = await readerMessages();
  const user = await getCurrentUser();
  if (!user) return { error: t("err.sessionShort") };

  const request = await db.panelRequest.findFirst({ where: { id: requestId }, select: { userId: true } });
  if (!request) return { error: t("panelReq.gone") };
  if (request.userId !== user.id && user.role !== "admin") return { error: t("err.adminOnly") };

  const outcome = await refreshDelegation(requestId);
  if ("key" in outcome) return { error: t(outcome.key, outcome.vars) };

  revalidatePath("/dashboard/panel");
  revalidatePath("/admin/panels");
  return { ok: true };
}

export async function approvePanelRequestAction(
  _prev: PanelRequestState,
  form: FormData,
): Promise<PanelRequestState> {
  const t = await readerMessages();
  const admin = await requireAdmin();
  const parent = await getCurrentPanel();
  if (!parent) return { error: t("adm.panelMissing") };

  const requestId = String(form.get("requestId") ?? "");
  const adminUsername = String(form.get("adminUsername") ?? "").trim();
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(adminUsername)) {
    return { fieldErrors: { adminUsername: t("adm.usernameShape") } };
  }
  const adminEmail = String(form.get("adminEmail") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
    return { fieldErrors: { adminEmail: t("adm.emailRequired") } };
  }
  const adminPassword = String(form.get("adminPassword") ?? "");
  if (adminPassword.length < 8) return { fieldErrors: { adminPassword: t("err.passwordLength") } };

  const outcome = await approvePanelRequest(parent, requestId, { adminUsername, adminEmail, adminPassword });
  if ("key" in outcome) return { error: t(outcome.key, outcome.vars) };

  await logActivity(admin.id, "admin.panel.request.approve", requestId);
  revalidatePath("/admin/panels");
  return { ok: true };
}

export async function rejectPanelRequestAction(requestId: string, reason: string): Promise<PanelRequestState> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const outcome = await rejectPanelRequest(requestId, reason.trim().slice(0, 500));
  if ("key" in outcome) return { error: t(outcome.key, outcome.vars) };

  await logActivity(admin.id, "admin.panel.request.reject", requestId);
  revalidatePath("/admin/panels");
  revalidatePath("/dashboard/panel");
  return { ok: true };
}
