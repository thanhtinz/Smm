import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { getSetting } from "./settings";
import { generateRecoveryCodes, normaliseRecoveryCode, verifyCode } from "./totp";

/**
 * Two-factor sign-in for staff accounts.
 *
 * The panel holds customer balances, so an admin password on its own is a
 * single point of failure. Only staff are covered: a customer locked out of
 * their own wallet by a lost phone is a support burden the panel gains
 * nothing from.
 */

export const PENDING_COOKIE = "nova_2fa";
const PENDING_MINUTES = 10;

export const STAFF_ROLES = new Set(["admin", "support"]);

/** Whether this account must pass a second factor before it gets a session. */
export function twoFactorActive(user: { role: string; totpEnabledAt: Date | null }): boolean {
  return STAFF_ROLES.has(user.role) && user.totpEnabledAt !== null;
}

/** Whether the panel insists staff set it up before they can work. */
export async function twoFactorRequired(): Promise<boolean> {
  return Boolean(await getSetting("auth.requireAdminTwoFactor"));
}

/**
 * Parks a half-finished sign-in.
 *
 * The password has been accepted but no session exists yet — that only
 * happens once the code checks out. The ticket is a row rather than a signed
 * cookie so it can be spent exactly once and revoked by deleting it.
 */
export async function startPendingLogin(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  await db.authToken.updateMany({
    where: { userId, type: "totp", usedAt: null },
    data: { usedAt: new Date() },
  });
  await db.authToken.create({
    data: { userId, type: "totp", token, expiresAt: new Date(Date.now() + PENDING_MINUTES * 60_000) },
  });

  const jar = await cookies();
  jar.set(PENDING_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PENDING_MINUTES * 60,
  });
}

/** The account waiting on a code, or null when there is no live ticket. */
export async function pendingLogin() {
  const jar = await cookies();
  const token = jar.get(PENDING_COOKIE)?.value;
  if (!token) return null;

  const row = await db.authToken.findUnique({ where: { token }, include: { user: true } });
  if (!row || row.type !== "totp" || row.usedAt || row.expiresAt < new Date()) return null;
  return row;
}

export async function clearPendingLogin(id?: string): Promise<void> {
  if (id) await db.authToken.update({ where: { id }, data: { usedAt: new Date() } });
  const jar = await cookies();
  jar.delete(PENDING_COOKIE);
}

/**
 * Accepts either factor: the code the app is showing, or one recovery code.
 * A recovery code is burned on use, so the same slip of paper cannot be
 * replayed by whoever else has seen it.
 */
export async function acceptSecondFactor(
  user: { id: string; totpSecret: string },
  submitted: string,
): Promise<"code" | "recovery" | null> {
  if (verifyCode(user.totpSecret, submitted)) return "code";

  const digits = normaliseRecoveryCode(submitted);
  if (digits.length !== 10) return null;

  const codes = await db.recoveryCode.findMany({ where: { userId: user.id, usedAt: null } });
  for (const row of codes) {
    if (await bcrypt.compare(digits, row.codeHash)) {
      await db.recoveryCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
      return "recovery";
    }
  }
  return null;
}

/**
 * Replaces the account's recovery codes and returns the readable ones. This
 * is the only moment they exist in plain text — nothing stores them, so the
 * screen that shows them is the customer's only copy.
 */
export async function issueRecoveryCodes(userId: string): Promise<string[]> {
  const codes = generateRecoveryCodes();
  await db.recoveryCode.deleteMany({ where: { userId } });
  await db.recoveryCode.createMany({
    data: await Promise.all(
      codes.map(async (code) => ({ userId, codeHash: await bcrypt.hash(normaliseRecoveryCode(code), 10) })),
    ),
  });
  return codes;
}

export async function unusedRecoveryCount(userId: string): Promise<number> {
  return db.recoveryCode.count({ where: { userId, usedAt: null } });
}
