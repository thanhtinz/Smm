"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser, logActivity } from "@/lib/auth";

/** Rotating invalidates the old key immediately — that is the point of it. */
export async function regenerateApiKeyAction() {
  const user = await getCurrentUser();
  if (!user) return;

  await db.user.update({
    where: { id: user.id },
    data: { apiKey: randomBytes(24).toString("hex") },
  });
  await logActivity(user.id, "api.key.rotate");
  revalidatePath("/dashboard/api");
}
