"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, logActivity } from "@/lib/auth";
import { readerMessages } from "@/lib/context";
import { getRootPanel, currentPanelId } from "@/lib/tenancy";
import { cronJob } from "@/lib/cron-jobs";
import type { ActionResult } from "./catalogue";

export type { ActionResult };

export type JobRun = ActionResult & { summary?: string; failures?: string[] };

/**
 * Runs one scheduled job by hand.
 *
 * Root panel only, like the whole-cycle button: a job covers every panel in
 * the deployment, so a child panel's admin pressing it would be doing work on
 * their parent's behalf and billing their parent's providers.
 *
 * The result is returned rather than only logged. The reason to press one of
 * these is that something is wrong, and "it ran" is not an answer — "0 sent,
 * 2 failures: provider X out of funds" is.
 */
export async function runCronJobAction(key: string): Promise<JobRun> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const root = await getRootPanel();
  if (!root || root.id !== (await currentPanelId())) return { error: t("err.rootOnly") };

  const job = cronJob(key);
  if (!job) return { error: t("adm.unknownJob") };

  try {
    const result = await job.run();
    await logActivity(admin.id, "admin.cron.run", `${key}: ${result.summary}`);
    revalidatePath("/admin/cron");
    return { ok: true, summary: result.summary, failures: result.failures };
  } catch (e) {
    // Surfaced, not swallowed: this screen exists to diagnose, and a job that
    // dies with a generic message leaves the operator exactly where they were.
    const message = e instanceof Error ? e.message : String(e);
    await logActivity(admin.id, "admin.cron.failed", `${key}: ${message}`);
    return { error: message };
  }
}
