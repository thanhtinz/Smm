"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { SESSION_COOKIE, logActivity, requireUser } from "@/lib/auth";

export type SessionActionResult = { ok?: true; error?: string; closed?: number };

/**
 * Ends one sign-in.
 *
 * Scoped to the caller's own rows, so an id guessed from somewhere else
 * closes nothing. Ending the current one is allowed — signing this device
 * out is a reasonable thing to want from this screen.
 */
export async function revokeSessionAction(id: string): Promise<SessionActionResult> {
  const user = await requireUser();
  const row = await db.session.findFirst({ where: { id, userId: user.id } });
  if (!row) return { error: "That sign-in is already closed." };

  await db.session.delete({ where: { id: row.id } });
  await logActivity(user.id, "auth.session.revoke");

  const jar = await cookies();
  if (jar.get(SESSION_COOKIE)?.value === row.token) jar.delete(SESSION_COOKIE);

  revalidatePath("/dashboard/profile");
  return { ok: true, closed: 1 };
}

/** Everywhere but here — the answer to a laptop left signed in somewhere. */
export async function revokeOtherSessionsAction(): Promise<SessionActionResult> {
  const user = await requireUser();
  const jar = await cookies();
  const current = jar.get(SESSION_COOKIE)?.value ?? "";

  const { count } = await db.session.deleteMany({
    where: { userId: user.id, NOT: { token: current } },
  });
  await logActivity(user.id, "auth.session.revokeOthers", String(count));

  revalidatePath("/dashboard/profile");
  return { ok: true, closed: count };
}
