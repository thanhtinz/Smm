import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { dateFormats } from "@/lib/dates";
import AnnouncementManager from "@/components/admin/announcement-manager";

export const metadata: Metadata = { title: "Announcements" };

export default async function AdminAnnouncementsPage() {
  const { t, locale, timezone } = await getAppContext();
  const dates = dateFormats(locale, timezone);
  const rows = await db.announcement.findMany({ orderBy: { createdAt: "desc" } });

  const fmt = { format: dates.full };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <AnnouncementManager
        rows={rows.map((a) => ({
          id: a.id,
          title: a.title,
          body: a.body,
          level: a.level,
          enabled: a.enabled,
          createdAt: fmt.format(a.createdAt),
        }))}
        labels={{
          close: t("common.close"),
          title: t("announcement.title"),
          new: t("announcement.new"),
          empty: t("announcement.empty"),
          heading: t("announcement.heading"),
          message: t("announcement.message"),
          level: t("announcement.level"),
          shown: t("announcement.shown"),
          hidden: t("announcement.hidden"),
          "level.info": t("announcement.level.info"),
          "level.success": t("announcement.level.success"),
          "level.warning": t("announcement.level.warning"),
          "level.danger": t("announcement.level.danger"),
          edit: t("admin.edit"),
          delete: t("admin.delete"),
          confirmDelete: t("admin.confirmDelete"),
          save: t("common.save"),
        }}
      />
    </div>
  );
}
