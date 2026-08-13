"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  createSession,
  destroySessionsFor,
  hashPassword,
  logActivity,
  requireUser,
  verifyPassword,
} from "@/lib/auth";

export type ProfileState = { ok?: true; error?: string; fieldErrors?: Record<string, string> };

export async function updateProfileAction(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const user = await requireUser();
  const fullName = String(form.get("fullName") ?? "").trim();
  if (fullName.length > 80) return { fieldErrors: { fullName: "At most 80 characters" } };

  await db.user.update({ where: { id: user.id }, data: { fullName } });
  revalidatePath("/dashboard/profile");
  return { ok: true };
}

/**
 * Changing a password signs every other session out, the same as a reset
 * does: the reason to change one is usually that someone else might have it.
 * The session doing the changing is put back so the page does not log itself
 * out mid-save.
 */
export async function changePasswordAction(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const user = await requireUser();

  const current = String(form.get("current") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { password: true } });
  if (!(await verifyPassword(current, fresh.password))) {
    return { fieldErrors: { current: "That is not your current password" } };
  }
  if (password.length < 8) return { fieldErrors: { password: "At least 8 characters" } };
  if (password !== confirm) return { fieldErrors: { confirm: "The passwords do not match" } };

  await db.user.update({ where: { id: user.id }, data: { password: await hashPassword(password) } });
  await destroySessionsFor(user.id);
  await createSession(user.id);
  await logActivity(user.id, "auth.password.change");

  revalidatePath("/dashboard/profile");
  return { ok: true };
}
