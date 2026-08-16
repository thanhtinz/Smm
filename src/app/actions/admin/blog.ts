"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, logActivity } from "@/lib/auth";
import { readerMessages } from "@/lib/context";
import { getSetting } from "@/lib/settings";
import { parseLocalTime } from "@/lib/dates";
import { pingIndexNow } from "@/lib/seo";
import { checkCallbackUrl } from "@/lib/callbacks";
import type { ActionResult } from "./catalogue";

export type { ActionResult };

/**
 * The blog.
 *
 * Static pages answer the questions a customer asks after they arrive; posts
 * are meant to be why they arrive at all. That is the only real difference,
 * and it is why these carry their own meta tags, an excerpt and a date, while
 * a terms page carries none of them.
 */

function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function revalidateBlog(slug?: string) {
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  if (slug) revalidatePath(`/blog/${slug}`);
  // The footer links the blog once there is anything in it.
  revalidatePath("/", "layout");
}

export async function saveBlogPostAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const id = String(form.get("id") ?? "");
  const title = String(form.get("title") ?? "").trim();
  if (!title) return { fieldErrors: { title: t("adm.titleRequired") } };

  const slug = slugify(String(form.get("slug") ?? "").trim() || title);
  if (!slug) return { fieldErrors: { slug: t("adm.slugRequired") } };

  const clash = await db.blogPost.findFirst({ where: { slug, ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
  if (clash) return { fieldErrors: { slug: t("adm.addressTaken") } };

  // A publish date with no zone means the operator's wall clock, which is the
  // panel's — the same reading every other date on the admin side gets.
  const timezone = String(await getSetting("locale.timezone")) || "UTC";
  const typed = String(form.get("publishedAt") ?? "").trim();
  const publish = form.get("published") === "on";

  // Unticking the box makes the post a draft and clears the date with it.
  // Keeping a future date on an unticked post was tried and reverted: the box
  // is drawn from `publishedAt`, so the post came back with the box ticked
  // again and the operator's own action undone in front of them. One field
  // carries both facts, so the two have to agree.
  let publishedAt: Date | null = null;
  if (publish) {
    if (typed) {
      publishedAt = parseLocalTime(typed, timezone);
      if (!publishedAt) return { fieldErrors: { publishedAt: t("adm.dateInvalid") } };
    } else {
      publishedAt = new Date();
    }
  }

  // Written straight into an <img src>, so the schemes that are not images are
  // refused here rather than rendered. A relative path is the common case —
  // the upload control produces one — and is left alone.
  const coverUrl = String(form.get("coverUrl") ?? "").trim();
  if (coverUrl && !coverUrl.startsWith("/") && !checkCallbackUrl(coverUrl).ok) {
    return { fieldErrors: { coverUrl: t("err.callback.scheme") } };
  }

  const data = {
    slug,
    title,
    excerpt: String(form.get("excerpt") ?? "").trim(),
    // HTML written by the panel's own admin, the same author as every other
    // string on the site — there is no untrusted author here.
    body: String(form.get("body") ?? "").trim(),
    coverUrl,
    tags: String(form.get("tags") ?? "").trim(),
    author: String(form.get("author") ?? "").trim(),
    metaTitle: String(form.get("metaTitle") ?? "").trim(),
    metaDescription: String(form.get("metaDescription") ?? "").trim(),
    publishedAt,
  };

  if (id) await db.blogPost.update({ where: { id }, data });
  else await db.blogPost.create({ data });

  // Only once it is actually readable. Submitting a post dated for next
  // Tuesday asks a crawler to fetch a 404 and remember the address as broken.
  if (publishedAt && publishedAt <= new Date()) await pingIndexNow([`/blog/${slug}`]);

  await logActivity(admin.id, id ? "admin.blog.update" : "admin.blog.create", `${title} (/blog/${slug})`);
  revalidateBlog(slug);
  return { ok: true };
}

export async function deleteBlogPostAction(id: string): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const post = await db.blogPost.findUnique({ where: { id } });
  if (!post) return { error: t("blog.missing") };

  await db.blogPost.delete({ where: { id } });
  await logActivity(admin.id, "admin.blog.delete", post.title);
  revalidateBlog(post.slug);
  return { ok: true };
}

/** Publishes now, or takes a published post back to a draft. */
export async function setBlogPostPublishedAction(id: string, published: boolean): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const post = await db.blogPost.findUnique({ where: { id } });
  if (!post) return { error: t("blog.missing") };

  await db.blogPost.update({ where: { id }, data: { publishedAt: published ? new Date() : null } });
  if (published) await pingIndexNow([`/blog/${post.slug}`]);

  await logActivity(admin.id, "admin.blog.publish", `${post.title} -> ${published ? "live" : "draft"}`);
  revalidateBlog(post.slug);
  return { ok: true };
}
