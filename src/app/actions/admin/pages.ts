"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, logActivity } from "@/lib/auth";
import type { ActionResult } from "./catalogue";

export type { ActionResult };

function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function revalidatePages() {
  revalidatePath("/admin/pages");
  // The footer lists them on every page of the site, so the whole layout goes.
  revalidatePath("/", "layout");
  revalidatePath("/p/[slug]", "page");
}

export async function savePageAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const id = String(form.get("id") ?? "");
  const title = String(form.get("title") ?? "").trim();
  if (!title) return { fieldErrors: { title: "Enter a title" } };

  const slug = slugify(String(form.get("slug") ?? "").trim() || title);
  if (!slug) return { fieldErrors: { slug: "Enter a slug" } };

  const clash = await db.page.findFirst({ where: { slug, ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
  if (clash) return { fieldErrors: { slug: "That address is already used" } };

  const data = {
    slug,
    title,
    // Written as HTML by the panel's own admin, who is also the only author of
    // every other string on the site — there is no untrusted author here.
    body: String(form.get("body") ?? "").trim(),
    published: form.get("published") === "on",
    showInFooter: form.get("showInFooter") === "on",
    position: Number(String(form.get("position") ?? "0")) || 0,
  };

  if (id) await db.page.update({ where: { id }, data });
  else await db.page.create({ data });

  await logActivity(admin.id, id ? "admin.page.update" : "admin.page.create", `${title} (/p/${slug})`);
  revalidatePages();
  return { ok: true };
}

export async function deletePageAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const row = await db.page.findFirst({ where: { id } });
  if (!row) return { error: "Page not found" };

  await db.page.delete({ where: { id } });
  await logActivity(admin.id, "admin.page.delete", row.title);
  revalidatePages();
  return { ok: true };
}

export async function setPagePublishedAction(id: string, published: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  const row = await db.page.findFirst({ where: { id } });
  if (!row) return { error: "Page not found" };

  await db.page.update({ where: { id }, data: { published } });
  await logActivity(admin.id, "admin.page.toggle", `${row.title} ${published ? "on" : "off"}`);
  revalidatePages();
  return { ok: true };
}
