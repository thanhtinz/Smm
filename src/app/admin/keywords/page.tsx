import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { dateFormats } from "@/lib/dates";
import { activeRankSource } from "@/lib/rank/drivers";
import KeywordManager from "@/components/admin/keyword-manager";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Rankings" };

export default async function AdminKeywordsPage() {
  const { t, locale, timezone } = await getAppContext();
  const dates = dateFormats(locale, timezone);
  const rows = await db.keyword.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] });

  // Sorting by position puts unranked phrases first, since zero sorts lowest —
  // exactly backwards from what the operator wants to see at the top.
  const sorted = [...rows].sort((a, b) => {
    if (a.position === 0 && b.position === 0) return a.createdAt.getTime() - b.createdAt.getTime();
    if (a.position === 0) return 1;
    if (b.position === 0) return -1;
    return a.position - b.position;
  });

  const source = await activeRankSource();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* A page of empty readings with no explanation is the worst version of
          this screen, so the reason is stated before the table. */}
      {!source.ok && (
        <div className="alert alert-warning" role="status">
          <Icon name="alert" size={16} />
          <span>
            {source.reason === "off"
              ? t("rank.setup.off")
              : source.reason === "noSource"
                ? t("rank.setup.noSource")
                : t("rank.setup.missing", { fields: source.reason.slice("missing:".length).split(",").join(", ") })}{" "}
            <Link href="/admin/settings/seo" className="underline">
              {t("rank.setup.link")}
            </Link>
          </span>
        </div>
      )}

      <KeywordManager
        rows={sorted.map((k) => ({
          id: k.id,
          phrase: k.phrase,
          country: k.country,
          position: k.position,
          lastPosition: k.lastPosition,
          url: k.url,
          checkedAt: k.checkedAt ? dates.stamp(k.checkedAt) : "",
          lastError: k.lastError,
        }))}
        labels={{
          title: t("rank.title"),
          intro: t("rank.intro"),
          phrase: t("rank.phrase"),
          phraseHint: t("rank.phraseHint"),
          country: t("rank.country"),
          position: t("rank.position"),
          checked: t("rank.checked"),
          notFound: t("rank.notFound"),
          notChecked: t("rank.notChecked"),
          up: t("rank.up"),
          down: t("rank.down"),
          add: t("block.add"),
          empty: t("rank.empty"),
          checkNow: t("rank.checkNow"),
          delete: t("admin.delete"),
        }}
      />
    </div>
  );
}
