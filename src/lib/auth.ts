import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db } from "./db";
import { getCurrentPanel } from "./tenancy";

export const SESSION_COOKIE = "nova_session";
const SESSION_DAYS = 30;

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  const h = await headers();
  await db.session.create({
    data: {
      userId,
      token,
      expiresAt,
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "",
      userAgent: h.get("user-agent") ?? "",
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  return token;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { token } });
  jar.delete(SESSION_COOKIE);
}

/** Signs an account out everywhere. Used when a password is reset. */
export async function destroySessionsFor(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}

export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  if (session.user.banned) return null;
  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}

/**
 * Admin of the root panel.
 *
 * Languages, translations, currencies and themes are shared by every panel —
 * one copy, not one per tenant — so editing those rows from a child panel
 * would change what every other panel sees. A panel still picks its own
 * default language, currency and theme; those live in its own settings.
 */
export async function requireRootAdmin() {
  const user = await requireAdmin();
  const panel = await getCurrentPanel();
  if (!panel || panel.parentId !== null) throw new Error("FORBIDDEN");
  return user;
}

export async function logActivity(userId: string | null, action: string, detail = "") {
  const h = await headers();
  await db.activityLog.create({
    data: {
      userId,
      action,
      detail,
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "",
    },
  });
}
