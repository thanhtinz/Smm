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
    const options = (def as { options?: readonly string[] }).options;
    const entry: SettingField = {
      key,
      label: named === `setting.${key}` ? "" : named,
      // The image control needs its own three, and only it uses them.
      hint: t("setting.imageHint"),
      uploadLabel: t("admin.upload"),
      removeLabel: t("admin.remove"),
      type: (def as { type: string }).type,
      options: options ? [...options] : undefined,
      // A stored value like "priceBoard" is a code, not a word. Where the
      // dictionary names one, the operator reads the name; where it does
      // not, the code stands in rather than an empty option.
      optionLabels: options
        ? Object.fromEntries(
            options.map((o) => {
              const label = t(`settingOption.${key}.${o}`);
              return [o, label === `settingOption.${key}.${o}` ? o : label];
            }),
          )
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
