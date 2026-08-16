import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { getSetting } from "@/lib/settings";
import SavedReplyManager from "@/components/admin/saved-reply-manager";

export const metadata: Metadata = { title: "Saved replies" };

export default async function AdminSavedRepliesPage() {
  const { t } = await getAppContext();

  const [rows, categories] = await Promise.all([
    // Most-used first within a position, so the list orders itself once it has
    // been used for a week and an operator never has to number them.
    db.savedReply.findMany({ orderBy: [{ position: "asc" }, { uses: "desc" }, { title: "asc" }] }),
    getSetting("support.categories"),
  ]);

  const categoryList = [...(categories as readonly string[])];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <SavedReplyManager
        rows={rows.map((r) => ({
          id: r.id,
          title: r.title,
          body: r.body,
          category: r.category,
          position: r.position,
          uses: r.uses,
        }))}
        categories={categoryList.map((c) => ({ value: c, label: t(`support.category.${c}`) }))}
        labels={{
          close: t("common.close"),
          title: t("reply.title"),
          hint: t("reply.hint"),
          new: t("reply.new"),
          edit: t("admin.edit"),
          delete: t("admin.delete"),
          confirmDelete: t("admin.confirmDelete"),
          empty: t("reply.empty"),
          replyTitle: t("admin.name"),
          body: t("support.message"),
          category: t("support.category"),
          categoryHint: t("reply.categoryHint"),
          anyCategory: t("reply.anyCategory"),
          uses: t("reply.uses"),
          egTitle: t("eg.replyTitle"),
          egBody: t("eg.replyBody"),
          position: t("admin.position"),
          save: t("common.save"),
          cancel: t("common.cancel"),
        }}
      />
    </div>
  );
}
