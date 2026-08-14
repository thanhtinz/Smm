"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, logActivity } from "@/lib/auth";
import { readerMessages } from "@/lib/context";
import { getRootPanel } from "@/lib/tenancy";
import { currentPanelId } from "@/lib/tenancy";
import { runSyncCycle } from "@/lib/chain-sync";
import type { ActionResult } from "./catalogue";

export type { ActionResult };

/**
 * Runs the cycle by hand.
 *
 * The point is diagnosis: when the overview says the scheduler has gone quiet,
 * the operator needs to know whether the cycle itself is broken or whether
 * nobody is calling it. Pressing this answers that in one click.
 *
 * Root panel only. One cycle covers every panel in the deployment, so a child
 * panel's admin pressing it would be doing work on their parent's behalf.
 */
export async function runSyncNowAction(): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const root = await getRootPanel();
  if (!root || root.id !== (await currentPanelId())) return { error: t("err.rootOnly") };

  await logActivity(admin.id, "admin.sync", admin.username);
  await runSyncCycle(`${admin.username}`);

  revalidatePath("/admin");
  return { ok: true };
}
