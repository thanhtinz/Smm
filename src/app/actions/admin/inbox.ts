"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { basePrisma } from "@/lib/db-base";
import { requireAdmin, getCurrentUser, logActivity } from "@/lib/auth";
import { readerMessages } from "@/lib/context";
import { currentPanelId } from "@/lib/tenancy";
import { STAFF_ROLES } from "@/lib/two-factor";
import { driverFor } from "@/lib/inbox/drivers";
import { reply as sendReply } from "@/lib/inbox/store";
import type { ActionResult } from "./catalogue";

export type { ActionResult };

function revalidateInbox(id?: string) {
  revalidatePath("/admin/inbox");
  revalidatePath("/admin/channels");
  if (id) revalidatePath(`/admin/inbox/${id}`);
}

/**
 * Connects an account.
 *
 * The credentials are checked against the platform before anything is
 * stored — a channel row that has never successfully talked to its API is
 * just a broken row somebody has to notice later.
 */
export async function connectChannelAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const kind = String(form.get("kind") ?? "");
  const driver = driverFor(kind);
  if (!driver) return { error: t("err.channelKind") };

  const config: Record<string, string> = {};
  for (const field of driver.fields) config[field.key] = String(form.get(field.key) ?? "").trim();
  const apiBase = String(form.get("apiBase") ?? "").trim();
  if (apiBase) config.apiBase = apiBase;

  const checked = await driver.check(config);
  if (!checked.ok) return { error: checked.error };

  const name = String(form.get("name") ?? "").trim() || checked.name;

  await db.channel.upsert({
    where: { panelId_kind_externalId: { panelId: await currentPanelId(), kind, externalId: checked.externalId } },
    create: { kind, name, externalId: checked.externalId, config: JSON.stringify(config), enabled: true },
    update: { name, config: JSON.stringify(config), enabled: true },
  });

  await logActivity(admin.id, "admin.channel.connect", `${kind} ${checked.name}`);
  revalidateInbox();
  return { ok: true };
}

export async function setChannelEnabledAction(id: string, enabled: boolean): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();
  const channel = await db.channel.findFirst({ where: { id } });
  if (!channel) return { error: t("err.channelGone") };

  await db.channel.update({ where: { id }, data: { enabled } });
  await logActivity(admin.id, "admin.channel.toggle", `${channel.name} ${enabled ? "on" : "off"}`);
  revalidateInbox();
  return { ok: true };
}

export async function deleteChannelAction(id: string): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();
  const channel = await db.channel.findFirst({ where: { id } });
  if (!channel) return { error: t("err.channelGone") };

  // Conversations cascade with the channel. That is deliberate: they are the
  // account's history, and keeping orphaned threads nobody can reply to would
  // be worse than losing them with the account they belong to.
  await db.channel.delete({ where: { id } });
  await logActivity(admin.id, "admin.channel.delete", channel.name);
  revalidateInbox();
  return { ok: true };
}

// ----------------------------------------------------------------- inbox

export async function replyAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const t = await readerMessages();
  const user = await getCurrentUser();
  if (!user) return { error: t("err.sessionShort") };
  if (!STAFF_ROLES.has(user.role)) return { error: t("err.supportOnly") };

  const conversationId = String(form.get("conversationId") ?? "");
  const body = String(form.get("body") ?? "").trim();
  if (!body) return { fieldErrors: { body: t("err.replyEmpty") } };

  try {
    await sendReply(conversationId, body, user.id);
  } catch (e) {
    // The platform refused it. Say so rather than showing the message in the
    // thread as though the customer had received it.
    return { error: e instanceof Error ? e.message : String(e) };
  }

  revalidateInbox(conversationId);
  return { ok: true };
}

export async function markReadAction(conversationId: string): Promise<ActionResult> {
  const t = await readerMessages();
  const user = await getCurrentUser();
  if (!user) return { error: t("err.sessionShort") };
  if (!STAFF_ROLES.has(user.role)) return { error: t("err.supportOnly") };

  const conversation = await db.conversation.findFirst({ where: { id: conversationId } });
  if (!conversation) return { error: t("err.threadGone") };

  await db.conversation.update({ where: { id: conversationId }, data: { unread: 0 } });
  revalidateInbox(conversationId);
  return { ok: true };
}

export async function setThreadStatusAction(conversationId: string, status: string): Promise<ActionResult> {
  const t = await readerMessages();
  const user = await getCurrentUser();
  if (!user) return { error: t("err.sessionShort") };
  if (!STAFF_ROLES.has(user.role)) return { error: t("err.supportOnly") };
  if (status !== "open" && status !== "closed") return { error: t("err.threadStatus") };

  const conversation = await db.conversation.findFirst({ where: { id: conversationId } });
  if (!conversation) return { error: t("err.threadGone") };

  await db.conversation.update({ where: { id: conversationId }, data: { status } });
  await logActivity(user.id, "inbox.status", `${conversation.contactName} -> ${status}`);
  revalidateInbox(conversationId);
  return { ok: true };
}

/**
 * The address this panel's channels are told to post to.
 *
 * Behind an admin check like everything else in this file. Every exported
 * function in a "use server" module is a callable endpoint, and this one
 * hands back the panel's webhook token — the secret that selects which panel
 * an incoming callback runs against. Without the check any visitor to the
 * site could ask for it.
 */
export async function webhookBaseFor(channelId: string, origin: string): Promise<string> {
  await requireAdmin();
  const panelId = await currentPanelId();
  const panel = await basePrisma.panel.findFirst({ where: { id: panelId } });
  return `${origin}/api/webhooks/${panel?.webhookToken ?? ""}/inbox/${channelId}`;
}
