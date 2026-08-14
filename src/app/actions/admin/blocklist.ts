"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, logActivity } from "@/lib/auth";
import { readerMessages } from "@/lib/context";
import type { ActionResult } from "./catalogue";

export type { ActionResult };

const KINDS = new Set(["link", "username"]);

export async function addBlockAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const kind = String(form.get("kind") ?? "link");
  const value = String(form.get("value") ?? "")
    .trim()
    .toLowerCase();
  if (!KINDS.has(kind)) return { error: t("adm.unknownKind") };
  if (!value) return { fieldErrors: { value: t("adm.valueRequired") } };

  // A one-character link entry matches nearly every URL there is. The check is
  // here rather than in the guard because that runs on every order, and by
  // then the damage is a panel refusing all business at once.
  if (kind === "link" && value.length < 4) return { fieldErrors: { value: t("adm.blockTooShort") } };

  const existing = await db.blocklist.findFirst({ where: { kind, value } });
  if (existing) return { fieldErrors: { value: t("adm.blockDuplicate") } };

  await db.blocklist.create({
    data: { kind, value, note: String(form.get("note") ?? "").trim() },
  });

  await logActivity(admin.id, "admin.blocklist.add", `${kind}: ${value}`);
  revalidatePath("/admin/blocklist");
  return { ok: true };
}

export async function removeBlockAction(id: string): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const row = await db.blocklist.findFirst({ where: { id } });
  if (!row) return { error: t("adm.blockMissing") };

  await db.blocklist.delete({ where: { id } });
  await logActivity(admin.id, "admin.blocklist.remove", `${row.kind}: ${row.value}`);
  revalidatePath("/admin/blocklist");
  return { ok: true };
}
