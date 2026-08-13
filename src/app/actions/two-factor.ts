"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createSession, destroySessionsFor, logActivity, requireUser, verifyPassword } from "@/lib/auth";
import { generateSecret, verifyCode } from "@/lib/totp";
import {
  acceptSecondFactor,
  clearPendingLogin,
  issueRecoveryCodes,
  pendingLogin,
  STAFF_ROLES,
  twoFactorRequired,
} from "@/lib/two-factor";

export type ChallengeState = { error?: string };
export type SetupState = { error?: string; fieldErrors?: Record<string, string>; codes?: string[]; ok?: true };

/**
 * The second half of signing in. The password was already accepted; without a
 * code the parked ticket expires and nothing was granted.
 */
export async function submitCodeAction(_prev: ChallengeState, form: FormData): Promise<ChallengeState> {
  const row = await pendingLogin();
  if (!row) return { error: "This sign-in has expired. Start again." };

  const submitted = String(form.get("code") ?? "").trim();
  const accepted = await acceptSecondFactor(row.user, submitted);
  if (!accepted) {
    await logActivity(row.userId, "login.2fa.failed");
    return { error: "That code is not right. Check the app and try again." };
  }

  await clearPendingLogin(row.id);
  await createSession(row.userId);
  await logActivity(row.userId, accepted === "recovery" ? "login.2fa.recovery" : "login.2fa.success");
  redirect(row.user.role === "admin" ? "/admin" : "/dashboard");
}

export async function cancelPendingLoginAction(): Promise<void> {
  const row = await pendingLogin();
  await clearPendingLogin(row?.id);
  redirect("/login");
}

/**
 * Hands out a fresh secret to set up against.
 *
 * Written to the account immediately but left unconfirmed: nothing guards the
 * login until a code proves the app actually holds it, so an abandoned setup
 * cannot lock anyone out.
 */
export async function beginSetupAction(): Promise<{ secret: string }> {
  const user = await requireUser();
  if (!STAFF_ROLES.has(user.role)) redirect("/dashboard");

  const secret = generateSecret();
  await db.user.update({ where: { id: user.id }, data: { totpSecret: secret, totpEnabledAt: null } });
  return { secret };
}

export async function confirmSetupAction(_prev: SetupState, form: FormData): Promise<SetupState> {
  const user = await requireUser();
  if (!STAFF_ROLES.has(user.role)) return { error: "Two-factor sign-in is for staff accounts." };

  const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { totpSecret: true } });
  if (!fresh.totpSecret) return { error: "Start the setup again." };

  const code = String(form.get("code") ?? "").trim();
  if (!verifyCode(fresh.totpSecret, code)) {
    return { fieldErrors: { code: "That code is not right. It changes every 30 seconds." } };
  }

  await db.user.update({ where: { id: user.id }, data: { totpEnabledAt: new Date() } });
  const codes = await issueRecoveryCodes(user.id);
  await logActivity(user.id, "auth.2fa.enabled");
  revalidatePath("/dashboard/profile");
  return { codes };
}

/**
 * Turning it off asks for the password, not a code: whoever is at the keyboard
 * already has a session, and the question worth asking is whether they are the
 * account holder.
 */
export async function disableAction(_prev: SetupState, form: FormData): Promise<SetupState> {
  const user = await requireUser();
  if (await twoFactorRequired()) {
    return { error: "This panel requires two-factor sign-in for staff accounts." };
  }

  const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { password: true } });
  if (!(await verifyPassword(String(form.get("password") ?? ""), fresh.password))) {
    return { fieldErrors: { password: "That is not your password" } };
  }

  await db.user.update({ where: { id: user.id }, data: { totpSecret: "", totpEnabledAt: null } });
  await db.recoveryCode.deleteMany({ where: { userId: user.id } });
  await logActivity(user.id, "auth.2fa.disabled");
  revalidatePath("/dashboard/profile");
  return { ok: true };
}

export async function regenerateRecoveryAction(_prev: SetupState, form: FormData): Promise<SetupState> {
  const user = await requireUser();
  const fresh = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { password: true, totpEnabledAt: true },
  });
  if (!fresh.totpEnabledAt) return { error: "Set up two-factor sign-in first." };
  if (!(await verifyPassword(String(form.get("password") ?? ""), fresh.password))) {
    return { fieldErrors: { password: "That is not your password" } };
  }

  const codes = await issueRecoveryCodes(user.id);
  await logActivity(user.id, "auth.2fa.recovery.regenerate");
  return { codes };
}

/**
 * An admin clearing two-factor off another account — the answer to a lost
 * phone and a lost recovery sheet. Every session of that account goes with
 * it, so a stolen device cannot keep the access it already had.
 */
export async function clearForUserAction(userId: string): Promise<{ ok?: true; error?: string }> {
  const admin = await requireUser();
  if (admin.role !== "admin") return { error: "Only an admin can do that." };

  const target = await db.user.findUnique({ where: { id: userId }, select: { username: true } });
  if (!target) return { error: "That account is not on this panel." };

  await db.user.update({ where: { id: userId }, data: { totpSecret: "", totpEnabledAt: null } });
  await db.recoveryCode.deleteMany({ where: { userId } });
  await destroySessionsFor(userId);
  await logActivity(admin.id, "admin.2fa.clear", target.username);
  revalidatePath("/admin/users");
  return { ok: true };
}
