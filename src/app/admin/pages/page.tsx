import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { dateFormats } from "@/lib/dates";
import PageManager from "@/components/admin/page-manager";

export const metadata: Metadata = { title: "Pages" };

export default async function AdminPagesPage() {
  const { t, locale, timezone } = await getAppContext();
  const dates = dateFormats(locale, timezone);
  const rows = await db.page.findMany({
    orderBy: [{ position: "asc" }, { title: "asc" }],
  });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageManager
        rows={rows.map((p) => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
          body: p.body,
          published: p.published,
          showInFooter: p.showInFooter,
          position: p.position,
          updatedAt: dates.full(p.updatedAt),
        }))}
        labels={{
          close: t("common.close"),
          title: t("page.title"),
          new: t("page.new"),
          empty: t("page.empty"),
          heading: t("page.heading"),
          address: t("page.address"),
          content: t("page.content"),
          position: t("admin.position"),
          published: t("page.published"),
          hidden: t("page.hidden"),
          footer: t("page.footer"),
          view: t("page.view"),
          edit: t("admin.edit"),
          delete: t("admin.delete"),
          confirmDelete: t("admin.confirmDelete"),
          save: t("common.save"),
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
