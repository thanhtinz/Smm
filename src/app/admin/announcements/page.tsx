import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import AnnouncementManager from "@/components/admin/announcement-manager";

export const metadata: Metadata = { title: "Announcements" };

export default async function AdminAnnouncementsPage() {
  const { t, locale } = await getAppContext();
  const rows = await db.announcement.findMany({ orderBy: { createdAt: "desc" } });

  const fmt = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

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
