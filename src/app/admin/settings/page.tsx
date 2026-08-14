import type { Metadata } from "next";
import { getAppContext } from "@/lib/context";
import { getSettings, settingDefinitions } from "@/lib/settings";
import SettingsForm, { type SettingField } from "@/components/admin/settings-form";

export const metadata: Metadata = { title: "Settings" };

/** The same fallback rule as a field's: a group nobody has named keeps its own. */
function groupTitle(group: string, t: (key: string) => string): string {
  const named = t(`settingGroup.${group}`);
  return named === `settingGroup.${group}` ? group : named;
}

export default async function AdminSettingsPage() {
  const { t } = await getAppContext();
  const current = await getSettings();

  // Grouped straight from the registry, so a new setting shows up here
  // without touching this page.
  const groups = new Map<string, SettingField[]>();
  for (const [key, def] of Object.entries(settingDefinitions)) {
    // t() answers with the key when there is no entry, which is how a setting
    // added since is left to the form's derived name rather than showing
    // "setting.foo.bar" to an operator.
    const named = t(`setting.${key}`);
    const entry: SettingField = {
      key,
      label: named === `setting.${key}` ? "" : named,
      type: (def as { type: string }).type,
      options: (def as { options?: readonly string[] }).options
        ? [...((def as { options?: readonly string[] }).options as readonly string[])]
        : undefined,
      value: (current as Record<string, unknown>)[key],
    };
    const group = (def as { group: string }).group;
    groups.set(group, [...(groups.get(group) ?? []), entry]);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <h2 className="text-2xl font-bold tracking-tight">{t("admin.settings")}</h2>

      <div className="grid gap-5 lg:grid-cols-2">
        {[...groups.entries()].map(([group, fields]) => (
          <SettingsForm
            key={group}
            group={group}
            title={groupTitle(group, t)}
            fields={fields}
            labels={{ save: t("common.save"), saved: t("admin.saved") }}
          />
        ))}
      </div>
    </div>
  );
}
