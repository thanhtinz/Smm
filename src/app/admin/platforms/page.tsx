import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import PlatformManager from "@/components/admin/platform-manager";

export const metadata: Metadata = { title: "Platforms" };

export default async function AdminPlatformsPage() {
  const { t } = await getAppContext();

  const platforms = await db.platform.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { _count: { select: { categories: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PlatformManager
        rows={platforms.map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          icon: p.icon,
          image: p.image,
          color: p.color,
          visible: p.visible,
          showServices: p.showServices,
          position: p.position,
          categoryCount: p._count.categories,
          hosts: p.hosts,
          postPattern: p.postPattern,
          profilePattern: p.profilePattern,
          postExample: p.postExample,
          profileExample: p.profileExample,
        }))}
        labels={{
          close: t("common.close"),
          egName: t("eg.platformName"),
          searchIcons: t("common.searchIcons"),
          title: t("admin.platforms"),
          new: t("admin.new"),
          edit: t("admin.edit"),
          delete: t("admin.delete"),
          confirmDelete: t("admin.confirmDelete"),
          empty: t("common.none"),
          name: t("admin.name"),
          showServices: t("features.platformsShort"),
          slug: t("admin.slug"),
          slugHint: t("admin.slugHint"),
          icon: t("admin.icon"),
          image: t("admin.image"),
          imageHint: t("admin.imageHint"),
          iconFallback: t("admin.iconFallback"),
          upload: t("admin.upload"),
          remove: t("admin.remove"),
          color: t("admin.color"),
          position: t("admin.position"),
          visible: t("admin.visible"),
          hidden: t("admin.hidden"),
          categories: t("admin.categories"),
          status: t("common.status"),
          actions: t("common.actions"),
          linkRules: t("link.rules"),
          hosts: t("link.hosts"),
          hostsHint: t("link.hostsHint"),
          postPattern: t("link.postPattern"),
          profilePattern: t("link.profilePattern"),
          postExample: t("link.postExample"),
          profileExample: t("link.profileExample"),
          save: t("common.save"),
          cancel: t("common.cancel"),
        }}
      />
    </div>
  );
}
