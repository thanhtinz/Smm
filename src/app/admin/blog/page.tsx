import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { dateFormats, formatLocalInput } from "@/lib/dates";
import BlogManager from "@/components/admin/blog-manager";

export const metadata: Metadata = { title: "Blog" };

export default async function AdminBlogPage() {
  const { t, locale, timezone } = await getAppContext();
  const dates = dateFormats(locale, timezone);

  // Newest first, drafts among them: a draft is a post that has not gone out
  // yet, not a different kind of thing, and burying them under the published
  // ones is how one sits unfinished for a month.
  const rows = await db.blogPost.findMany({
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
  const now = new Date();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <BlogManager
        rows={rows.map((p) => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
          excerpt: p.excerpt,
          body: p.body,
          coverUrl: p.coverUrl,
          tags: p.tags,
          author: p.author,
          metaTitle: p.metaTitle,
          metaDescription: p.metaDescription,
          publishedAt: p.publishedAt
            ? formatLocalInput(p.publishedAt, timezone)
            : "",
          live: p.publishedAt !== null && p.publishedAt <= now,
          scheduled: p.publishedAt !== null && p.publishedAt > now,
          publishedLabel: p.publishedAt ? dates.stamp(p.publishedAt) : "",
        }))}
        labels={{
          close: t("common.close"),
          title: t("blog.title"),
          hint: t("blog.hint"),
          new: t("blog.new"),
          empty: t("blog.empty"),
          edit: t("admin.edit"),
          delete: t("admin.delete"),
          confirmDelete: t("admin.confirmDelete"),
          publish: t("blog.publish"),
          unpublish: t("blog.unpublish"),
          live: t("blog.live"),
          scheduled: t("blog.scheduled"),
          draft: t("blog.draft"),
          postTitle: t("admin.name"),
          slug: t("admin.slug"),
          slugHint: t("blog.slugHint"),
          excerpt: t("blog.excerpt"),
          excerptHint: t("blog.excerptHint"),
          body: t("blog.body"),
          bodyHint: t("blog.bodyHint"),
          cover: t("blog.cover"),
          coverHint: t("blog.coverHint"),
          remove: t("admin.remove"),
          upload: t("admin.upload"),
          author: t("blog.author"),
          tags: t("admin.tags"),
          tagsHint: t("blog.tagsHint"),
          metaTitle: t("seo.metaTitle"),
          metaDescription: t("seo.metaDescription"),
          metaHint: t("blog.metaHint"),
          publishedFlag: t("blog.publishedFlag"),
          publishedAt: t("blog.publishedAt"),
          publishedAtHint: t("blog.publishedAtHint"),
          save: t("common.save"),
          cancel: t("common.cancel"),
        }}
        editor={{
          bold: t("editor.bold"),
          italic: t("editor.italic"),
          underline: t("editor.underline"),
          strike: t("editor.strike"),
          h2: t("editor.h2"),
          h3: t("editor.h3"),
          bullets: t("editor.bullets"),
          numbers: t("editor.numbers"),
          quote: t("editor.quote"),
          link: t("editor.link"),
          unlink: t("editor.unlink"),
          clear: t("editor.clear"),
          linkPrompt: t("editor.linkPrompt"),
        }}
      />
    </div>
  );
}
