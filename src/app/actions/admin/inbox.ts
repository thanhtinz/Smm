"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { basePrisma } from "@/lib/db-base";
import { requireAdmin, getCurrentUser, logActivity } from "@/lib/auth";
import { readerMessages } from "@/lib/context";
import { currentPanelId, panelBaseUrl } from "@/lib/tenancy";
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

  const channel = await db.channel.upsert({
    where: { panelId_kind_externalId: { panelId: await currentPanelId(), kind, externalId: checked.externalId } },
    create: { kind, name, externalId: checked.externalId, config: JSON.stringify(config), enabled: true },
    update: { name, config: JSON.stringify(config), enabled: true },
  });

  await logActivity(admin.id, "admin.channel.connect", `${kind} ${checked.name}`);
  revalidateInbox();

  // The address exists only once the row does, so the platform is told about
  // it here rather than before. A fresh secret each time: the old one stops
  // being accepted the moment this call succeeds, so a token that leaked
  // stops working when the operator reconnects.
  if (!driver.register) return { ok: true };

  const secret = randomBytes(24).toString("hex");
  const registered = await driver.register(
    config,
    `${await panelBaseUrl()}/api/webhooks/${await webhookToken()}/inbox/${channel.id}`,
    secret,
  );
  // Stored only after the platform has taken it, so what the panel expects on
  // the way in is what was actually handed over. A failure here leaves a
  // working channel that has not been told where to post — which is what the
  // operator needs to read, not a silent success.
  if (!registered.ok) return { error: registered.error };

  await db.channel.update({
    where: { id: channel.id },
    data: { config: JSON.stringify({ ...config, secret }) },
  });
  revalidateInbox();
  return { ok: true };
}

/** This panel's webhook token, which is the panel's name in a callback URL. */
async function webhookToken(): Promise<string> {
  const panel = await basePrisma.panel.findFirst({ where: { id: await currentPanelId() } });
  return panel?.webhookToken ?? "";
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
  // Admin, matching src/app/admin/layout.tsx, which lets support into
  // /admin/tickets and nowhere else. A server action is a POST endpoint, not a
  // path, so the layout never ran here — a support account could not open the
  // inbox but could still drive it, including sending messages out to
  // customers under the business's name.
  if (user.role !== "admin") return { error: t("err.supportOnly") };

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
  // Admin, matching src/app/admin/layout.tsx, which lets support into
  // /admin/tickets and nowhere else. A server action is a POST endpoint, not a
  // path, so the layout never ran here — a support account could not open the
  // inbox but could still drive it, including sending messages out to
  // customers under the business's name.
  if (user.role !== "admin") return { error: t("err.supportOnly") };

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
  // Admin, matching src/app/admin/layout.tsx, which lets support into
  // /admin/tickets and nowhere else. A server action is a POST endpoint, not a
  // path, so the layout never ran here — a support account could not open the
  // inbox but could still drive it, including sending messages out to
  // customers under the business's name.
  if (user.role !== "admin") return { error: t("err.supportOnly") };
  if (status !== "open" && status !== "closed") return { error: t("err.threadStatus") };

  const conversation = await db.conversation.findFirst({ where: { id: conversationId } });
  if (!conversation) return { error: t("err.threadGone") };

  await db.conversation.update({ where: { id: conversationId }, data: { status } });
  await logActivity(user.id, "inbox.status", `${conversation.contactName} -> ${status}`);
  revalidateInbox(conversationId);
  return { ok: true };
}
