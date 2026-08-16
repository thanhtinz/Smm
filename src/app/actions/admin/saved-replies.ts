"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser, logActivity, requireAdmin } from "@/lib/auth";
import { readerMessages } from "@/lib/context";
import { STAFF_ROLES } from "@/lib/two-factor";
import type { ActionResult } from "./catalogue";

export type { ActionResult };

/**
 * The replies support types often enough to stop typing.
 *
 * Writing them is an admin's job — they are the panel's voice, and a wording
 * mistake here is repeated to every customer who asks the same question — but
 * using one is any staff member's, which is why the counter below has a
 * different guard from everything else in this file.
 */

export async function saveSavedReplyAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const id = String(form.get("id") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  if (!title) return { fieldErrors: { title: t("adm.nameRequired") } };
  if (!body) return { fieldErrors: { body: t("reply.bodyRequired") } };

  const data = {
    title,
    body,
    category: String(form.get("category") ?? "").trim(),
    position: Number(String(form.get("position") ?? "0")) || 0,
  };

  const reply = id
    ? await db.savedReply.update({ where: { id }, data })
    : await db.savedReply.create({ data });

  await logActivity(admin.id, id ? "admin.reply.update" : "admin.reply.create", reply.title);
  revalidateReplies();
  return { ok: true };
}

export async function deleteSavedReplyAction(id: string): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const reply = await db.savedReply.findUnique({ where: { id } });
  if (!reply) return { error: t("reply.missing") };

  await db.savedReply.delete({ where: { id } });
  await logActivity(admin.id, "admin.reply.delete", reply.title);
  revalidateReplies();
  return { ok: true };
}

/**
 * Records that a reply was used, so the list can order itself.
 *
 * Named for what it records rather than "useSavedReply", which reads as a
 * React hook to both a person skimming the import list and to the lint rule
 * that enforces where hooks may be called.
 *
 * Guarded on staff rather than on admin: the whole point is that the support
 * desk uses these, and the support role cannot call an admin-only action. It
 * writes nothing but a counter, which is why that is a safe line to draw.
 */
export async function recordSavedReplyUseAction(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !STAFF_ROLES.has(user.role)) return { error: "" };

  await db.savedReply.updateMany({ where: { id }, data: { uses: { increment: 1 } } });
  return { ok: true };
}

function revalidateReplies() {
  revalidatePath("/admin/saved-replies");
  revalidatePath("/admin/tickets");
}
