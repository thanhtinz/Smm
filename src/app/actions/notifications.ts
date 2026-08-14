"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export type NotificationResult = { ok?: true; error?: string };

function revalidateNotifications() {
  // The bell sits in the shell, so the count is stale on every signed-in page
  // until the layout is rebuilt.
  revalidatePath("/dashboard", "layout");
  revalidatePath("/admin", "layout");
}

/**
 * Marking one read is a side effect of opening it, so it is deliberately
 * forgiving: a row that is gone or belongs to someone else is a no-op rather
 * than an error the reader would have to dismiss.
 */
export async function markNotificationReadAction(id: string): Promise<NotificationResult> {
  const user = await requireUser();
  await db.notification.updateMany({ where: { id, userId: user.id }, data: { read: true } });
  revalidateNotifications();
  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<NotificationResult> {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
  revalidateNotifications();
  return { ok: true };
}

/** Clears what has already been read; anything unread survives. */
export async function clearReadNotificationsAction(): Promise<NotificationResult> {
  const user = await requireUser();
  await db.notification.deleteMany({ where: { userId: user.id, read: true } });
  revalidateNotifications();
  revalidatePath("/dashboard/notifications");
  return { ok: true };
}
