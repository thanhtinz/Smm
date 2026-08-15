"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, logActivity } from "@/lib/auth";
import { readerMessages } from "@/lib/context";
import { checkPanelRanks } from "@/lib/rank/tracker";
import type { ActionResult } from "./catalogue";

export type { ActionResult };

export async function addKeywordAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const phrase = String(form.get("phrase") ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const country = String(form.get("country") ?? "vn")
    .trim()
    .toLowerCase();

  if (!phrase) return { fieldErrors: { phrase: t("adm.phraseRequired") } };
  if (phrase.length > 120) return { fieldErrors: { phrase: t("err.tooLong") } };
  if (!/^[a-z]{2}$/.test(country)) return { fieldErrors: { country: t("adm.countryShape") } };

  const existing = await db.keyword.findFirst({ where: { phrase, country } });
  if (existing) return { fieldErrors: { phrase: t("adm.phraseDuplicate") } };

  await db.keyword.create({ data: { phrase, country } });
  await logActivity(admin.id, "admin.keyword.add", `${phrase} (${country})`);
  revalidatePath("/admin/keywords");
  return { ok: true };
}

export async function removeKeywordAction(id: string): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const row = await db.keyword.findFirst({ where: { id } });
  if (!row) return { error: t("adm.keywordMissing") };

  await db.keyword.delete({ where: { id } });
  await logActivity(admin.id, "admin.keyword.remove", row.phrase);
  revalidatePath("/admin/keywords");
  return { ok: true };
}

/**
 * Reads every phrase now, ignoring the interval.
 *
 * The button exists to answer "is my configuration right", which is a
 * question nobody wants to wait a day for. It is also the only place a source
 * error is worth putting in front of the operator as a message rather than a
 * column, because they just asked.
 */
export async function checkRanksNowAction(): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const report = await checkPanelRanks(true);
  if (report.error) {
    const missing = report.error.startsWith("missing:") ? report.error.slice("missing:".length) : "";
    const message = missing
      ? t("adm.rankMissing", { fields: missing.split(",").join(", ") })
      : report.error === "off"
        ? t("adm.rankOff")
        : report.error === "noSource"
          ? t("adm.rankNoSource")
          : report.error;
    return { error: message };
  }

  await logActivity(admin.id, "admin.keyword.check", `${report.checked}/${report.keywords}`);
  revalidatePath("/admin/keywords");
  return { ok: true };
}
