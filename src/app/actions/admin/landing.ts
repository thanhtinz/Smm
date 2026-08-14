"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, logActivity } from "@/lib/auth";
import { readerMessages } from "@/lib/context";
import type { ActionResult } from "./catalogue";

export type { ActionResult };

/** Both of these show on the landing page, so the home page has to go. */
function revalidateLanding() {
  revalidatePath("/admin/landing");
  revalidatePath("/");
}

// ---------------------------------------------------------------- quotes

export async function saveTestimonialAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { fieldErrors: { name: t("adm.nameRequired") } };

  const body = String(form.get("body") ?? "").trim();
  if (!body) return { fieldErrors: { body: t("adm.bodyRequired") } };

  // Zero is meaningful — it prints the quote with no stars at all, for an
  // operator who would rather not put a score on someone's words.
  const rating = Math.min(5, Math.max(0, Number(String(form.get("rating") ?? "5")) || 0));

  const data = {
    name,
    role: String(form.get("role") ?? "").trim(),
    body,
    rating,
    avatar: String(form.get("avatar") ?? "").trim(),
    visible: form.get("visible") === "on",
    position: Number(String(form.get("position") ?? "0")) || 0,
  };

  if (id) await db.testimonial.update({ where: { id }, data });
  else await db.testimonial.create({ data });

  await logActivity(admin.id, id ? "admin.testimonial.update" : "admin.testimonial.create", name);
  revalidateLanding();
  return { ok: true };
}

export async function deleteTestimonialAction(id: string): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();
  const row = await db.testimonial.findFirst({ where: { id } });
  if (!row) return { error: t("adm.rowMissing") };

  await db.testimonial.delete({ where: { id } });
  await logActivity(admin.id, "admin.testimonial.delete", row.name);
  revalidateLanding();
  return { ok: true };
}

// ------------------------------------------------------------------- faq

export async function saveFaqAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const id = String(form.get("id") ?? "");
  const question = String(form.get("question") ?? "").trim();
  if (!question) return { fieldErrors: { question: t("adm.questionRequired") } };

  const answer = String(form.get("answer") ?? "").trim();
  if (!answer) return { fieldErrors: { answer: t("adm.answerRequired") } };

  const data = {
    question,
    answer,
    visible: form.get("visible") === "on",
    position: Number(String(form.get("position") ?? "0")) || 0,
  };

  if (id) await db.faq.update({ where: { id }, data });
  else await db.faq.create({ data });

  await logActivity(admin.id, id ? "admin.faq.update" : "admin.faq.create", question);
  revalidateLanding();
  return { ok: true };
}

export async function deleteFaqAction(id: string): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();
  const row = await db.faq.findFirst({ where: { id } });
  if (!row) return { error: t("adm.rowMissing") };

  await db.faq.delete({ where: { id } });
  await logActivity(admin.id, "admin.faq.delete", row.question);
  revalidateLanding();
  return { ok: true };
}
