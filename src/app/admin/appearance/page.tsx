import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import ThemeManager, { type ThemeRow } from "@/components/admin/theme-manager";

export const metadata: Metadata = { title: "Appearance" };

export default async function AdminAppearancePage() {
  const { t } = await getAppContext();
  const themes = await db.theme.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] });

  const rows: ThemeRow[] = themes.map((theme) => {
    let parsed: { radius?: string; font?: string; light?: Record<string, string>; dark?: Record<string, string> } = {};
    try {
      parsed = JSON.parse(theme.tokens);
    } catch {
      // A theme with unreadable tokens still lists, so it can be fixed here.
    }
    return {
      id: theme.id,
      slug: theme.slug,
      name: theme.name,
      description: theme.description,
      layout: theme.layout,
      enabled: theme.enabled,
      isDefault: theme.isDefault,
      position: theme.position,
      radius: parsed.radius ?? "16px",
      font: parsed.font ?? "",
      light: parsed.light ?? {},
      dark: parsed.dark ?? {},
    };
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <ThemeManager
        rows={rows}
        labels={{
          close: t("common.close"),
          egName: t("eg.themeName"),
          title: t("common.appearance"),
          new: t("admin.new"),
          edit: t("admin.edit"),
          confirmDelete: t("admin.confirmDelete"),
          name: t("admin.name"),
          slug: t("admin.slug"),
          description: t("admin.description"),
          radius: t("admin.radius"),
          layout: t("admin.layout"),
          font: t("admin.font"),
          position: t("admin.position"),
          light: t("common.light"),
          dark: t("common.dark"),
          enabled: t("admin.enabled"),
          disabled: t("admin.disabled"),
          default: t("admin.base"),
          makeDefault: t("admin.makeDefault"),
          save: t("common.save"),
          cancel: t("common.cancel"),
        }}
      />
    </div>
  );
}
