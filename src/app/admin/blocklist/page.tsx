import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { dateFormats } from "@/lib/dates";
import BlocklistManager from "@/components/admin/blocklist-manager";

export const metadata: Metadata = { title: "Blocklist" };

export default async function AdminBlocklistPage() {
  const { t, locale, timezone } = await getAppContext();
  const dates = dateFormats(locale, timezone);
  const rows = await db.blocklist.findMany({ orderBy: { createdAt: "desc" } });
  const fmt = { format: dates.stamp };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <BlocklistManager
        rows={rows.map((r) => ({
          id: r.id,
          kind: r.kind,
          value: r.value,
          note: r.note,
          createdAt: fmt.format(r.createdAt),
        }))}
        labels={{
          title: t("block.title"),
          intro: t("block.intro"),
          kind: t("block.kind"),
          "kind.link": t("block.kind.link"),
          "kind.username": t("block.kind.username"),
          value: t("block.value"),
          valueHint: t("block.valueHint"),
          note: t("admin.note"),
          add: t("block.add"),
          empty: t("block.empty"),
          delete: t("admin.delete"),
          confirmDelete: t("admin.confirmDelete"),
        }}
      />
    </div>
  );
}
