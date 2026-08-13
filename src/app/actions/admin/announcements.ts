"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, logActivity } from "@/lib/auth";
import type { ActionResult } from "./catalogue";

export type { ActionResult };

const LEVELS = new Set(["info", "success", "warning", "danger"]);

function revalidateAnnouncements() {
  revalidatePath("/admin/announcements");
  revalidatePath("/dashboard", "layout");
  revalidatePath("/", "layout");
}

export async function saveAnnouncementAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const id = String(form.get("id") ?? "");
  const title = String(form.get("title") ?? "").trim();
  if (!title) return { fieldErrors: { title: "Enter a title" } };

  const body = String(form.get("body") ?? "").trim();
  if (!body) return { fieldErrors: { body: "Enter the message" } };

  const level = String(form.get("level") ?? "info");
  const data = {
    title,
    body,
    level: LEVELS.has(level) ? level : "info",
    enabled: form.get("enabled") === "on",
  };

  if (id) await db.announcement.update({ where: { id }, data });
  else await db.announcement.create({ data });

  await logActivity(admin.id, id ? "admin.announcement.update" : "admin.announcement.create", title);
  revalidateAnnouncements();
  return { ok: true };
}

export async function deleteAnnouncementAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const row = await db.announcement.findUnique({ where: { id } });
  if (!row) return { error: "Announcement not found" };

  await db.announcement.delete({ where: { id } });
  await logActivity(admin.id, "admin.announcement.delete", row.title);
  revalidateAnnouncements();
  return { ok: true };
}

export async function setAnnouncementEnabledAction(id: string, enabled: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  const row = await db.announcement.findUnique({ where: { id } });
  if (!row) return { error: "Announcement not found" };

  await db.announcement.update({ where: { id }, data: { enabled } });
  await logActivity(admin.id, "admin.announcement.toggle", `${row.title} ${enabled ? "on" : "off"}`);
  revalidateAnnouncements();
  return { ok: true };
}
