"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, logActivity } from "@/lib/auth";
import { readerMessages } from "@/lib/context";
import { resolveCallbackUrl } from "@/lib/callbacks";

export type ActionResult = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

/**
 * Saves where this account wants to be called back.
 *
 * The address is checked here, when the reseller can see the answer and fix a
 * typo, rather than only at send time when the failure is a line in a table
 * they have to go looking for. It is checked again before each delivery all
 * the same: DNS moves, and what resolved publicly today may not tomorrow.
 */
export async function saveCallbackUrlAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const t = await readerMessages();
  const user = await requireUser();

  const raw = String(form.get("callbackUrl") ?? "").trim();

  if (raw) {
    const checked = await resolveCallbackUrl(raw);
    if (!checked.ok) return { fieldErrors: { callbackUrl: t(`err.callback.${checked.reason}`) } };
  }

  await db.user.update({ where: { id: user.id }, data: { callbackUrl: raw } });
  await logActivity(user.id, raw ? "api.callback.set" : "api.callback.clear", raw);
  revalidatePath("/dashboard/api");
  return { ok: true };
}
