import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import CategoryManager from "@/components/admin/category-manager";

export const metadata: Metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  const { t } = await getAppContext();

  const [categories, platforms] = await Promise.all([
    db.category.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      include: { _count: { select: { services: true } } },
    }),
    db.platform.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <CategoryManager
        rows={categories.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          platformId: c.platformId,
          visible: c.visible,
          position: c.position,
          serviceCount: c._count.services,
        }))}
        platforms={platforms.map((p) => ({ id: p.id, name: p.name, icon: p.icon, color: p.color }))}
        labels={{
          title: t("admin.categories"),
          new: t("admin.new"),
          edit: t("admin.edit"),
          delete: t("admin.delete"),
          confirmDelete: t("admin.confirmDelete"),
          empty: t("common.none"),
          name: t("admin.name"),
          description: t("admin.description"),
          position: t("admin.position"),
          visible: t("admin.visible"),
          hidden: t("admin.hidden"),
          platform: t("admin.platform"),
          allPlatforms: t("admin.allPlatforms"),
          services: t("admin.services"),
          status: t("common.status"),
          actions: t("common.actions"),
          filter: t("admin.filter"),
          save: t("common.save"),
          cancel: t("common.cancel"),
          needPlatform: t("admin.needPlatform"),
        }}
      />
    </div>
  );
}
