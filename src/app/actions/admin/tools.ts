"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, logActivity } from "@/lib/auth";
import { setSetting } from "@/lib/settings";
import { TOOLS } from "@/lib/tools";
import type { ActionResult } from "./catalogue";

export type { ActionResult };

/**
 * Which tools this panel offers.
 *
 * The setting is a plain JSON array and could be typed into the settings
 * form, but asking an operator to hand-write `["qr","json"]` to hide two
 * tools is not configuration, it is a chore. The form posts the tools it
 * wants kept; everything else goes on the disabled list.
 */
export async function saveToolsAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const keep = new Set(form.getAll("tool").map(String));
  const disabled = TOOLS.filter((tool) => !keep.has(tool.slug)).map((tool) => tool.slug);

  await setSetting("tools.disabled", disabled);
  await logActivity(admin.id, "admin.tools", `${TOOLS.length - disabled.length}/${TOOLS.length}`);

  revalidatePath("/admin/tools");
  revalidatePath("/tools");
  revalidatePath("/tools/[slug]", "page");
  return { ok: true };
}
