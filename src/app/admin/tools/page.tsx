import type { Metadata } from "next";
import { getAppContext } from "@/lib/context";
import ToolsForm from "@/components/admin/tools-form";
import { TOOLS, TOOL_GROUPS, enabledTools } from "@/lib/tools";

export const metadata: Metadata = { title: "Tools" };

export default async function AdminToolsPage() {
  const { t, settings } = await getAppContext();
  const on = new Set(enabledTools(settings["tools.disabled"]).map((tool) => tool.slug));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("tools.title")}</h2>
        <p className="muted mt-2 text-sm">{t("tools.adminHint")}</p>
      </div>

      <ToolsForm
        groups={TOOL_GROUPS.map((g) => ({ key: g, label: t(`tools.group.${g}`) }))}
        rows={TOOLS.map((tool) => ({
          slug: tool.slug,
          group: tool.group,
          name: t(`tool.${tool.slug}.name`),
          about: t(`tool.${tool.slug}.about`),
          enabled: on.has(tool.slug),
        }))}
        labels={{ save: t("common.save"), saved: t("admin.saved"), view: t("page.view") }}
      />
    </div>
  );
}
