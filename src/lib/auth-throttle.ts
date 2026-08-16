import { headers } from "next/headers";
import { db } from "./db";
import { getSetting } from "./settings";

/**
 * Slowing down the two doors a stranger can knock on for free.
 *
 * Sign-in ran an unbounded number of bcrypt comparisons: no attempt counter,
 * no lockout, no delay, and `auth.captchaProvider` off out of the box — so a
 * fresh panel could be ground for passwords at whatever rate the server would
 * sustain. Two-factor only covers the staff accounts that opted in, so an
 * ordinary customer's wallet had a password and nothing else in front of it.
 *
 * The counter is `ActivityLog`, which has recorded every `login.failed` with
 * its address since the beginning and which nothing has ever read. No new
 * table, and an operator can see the attempts that caused a lockout on the
 * page they already use.
 *
 * Counted per address *and* per identifier, because the two attacks are
 * different: one machine trying a thousand passwords against one account, and
 * a thousand machines trying one password against every account. Either
 * exceeding the limit closes that door, and only that door — a locked out
 * address does not lock out the account, so a stranger cannot use this to
 * keep somebody else signed out.
 */

/** The caller's address, as far as the proxy in front of us will say. */
export async function callerAddress(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

async function attemptsSince(action: string, since: Date, ip: string, detail: string): Promise<number> {
  const where = { action, createdAt: { gt: since } };
  const [byAddress, byTarget] = await Promise.all([
    ip ? db.activityLog.count({ where: { ...where, ip } }) : Promise.resolve(0),
    detail ? db.activityLog.count({ where: { ...where, detail } }) : Promise.resolve(0),
  ]);
  return Math.max(byAddress, byTarget);
}

/**
 * Whether this sign-in should be refused before the password is even checked.
 *
 * Zero switches it off, for an operator who fronts the panel with something
 * that already does this.
 */
export async function loginLocked(identifier: string): Promise<{ minutes: number } | null> {
  const limit = Number(await getSetting("auth.maxFailedLogins")) || 0;
  if (limit <= 0) return null;

  const minutes = Math.max(1, Number(await getSetting("auth.lockoutMinutes")) || 15);
  const since = new Date(Date.now() - minutes * 60_000);
  const failures = await attemptsSince("login.failed", since, await callerAddress(), identifier);

  return failures >= limit ? { minutes } : null;
}

/**
 * Whether this address has asked for too many verification emails.
 *
 * The action is public by necessity — you cannot be signed in to confirm the
 * address you are signing up with — and it had no captcha and no ceiling, so
 * repeating it flooded the victim's inbox, burned the panel's sending
 * reputation and grew `AuthToken` without limit. One send is one row in the
 * same log every other attempt is counted from.
 */
export async function resendLocked(email: string): Promise<boolean> {
  const limit = Number(await getSetting("auth.maxVerificationEmails")) || 0;
  if (limit <= 0) return false;

  const since = new Date(Date.now() - 60 * 60_000);
  return (await attemptsSince("auth.resend", since, await callerAddress(), email)) >= limit;
}
