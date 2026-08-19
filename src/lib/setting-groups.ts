import { settingDefinitions } from "./settings";
import type { SettingField } from "@/components/admin/settings-form";
import type { Translator } from "./i18n";

/**
 * The settings, arranged for someone who has to find one.
 *
 * One page held all thirteen sections and a hundred and eighteen fields, in
 * whatever order the registry happened to declare them — so changing the
 * minimum deposit meant scrolling past the SEO block and the SMTP block to
 * get to it. Each section is its own page now, and this is what decides where
 * they sit.
 *
 * The bands are the four questions an operator is actually answering: what the
 * shop looks like, how it trades, how accounts and integrations behave, and
 * how the business itself is run. A section that is not listed here still
 * appears — at the end, under "other" — because a settings page that silently
 * hides a setting is worse than one with an untidy last row.
 */
export const SETTING_BANDS: { key: string; groups: string[] }[] = [
  { key: "shopfront", groups: ["branding", "appearance", "locale", "seo"] },
  { key: "trading", groups: ["order", "wallet", "affiliate"] },
  { key: "accounts", groups: ["auth", "api", "support", "mail"] },
  { key: "operations", groups: ["features", "panel", "maintenance"] },
];

/** Every group in the registry, in the order above, with the rest appended. */
export function settingGroups(): string[] {
  const declared = new Set<string>();
  for (const def of Object.values(settingDefinitions)) declared.add((def as { group: string }).group);

  const ordered = SETTING_BANDS.flatMap((band) => band.groups).filter((g) => declared.has(g));
  const rest = [...declared].filter((g) => !ordered.includes(g));
  return [...ordered, ...rest];
}

/** The bands, with any group the bands do not mention gathered into a last one. */
export function settingBands(): { key: string; groups: string[] }[] {
  const known = new Set(SETTING_BANDS.flatMap((b) => b.groups));
  const leftovers = settingGroups().filter((g) => !known.has(g));
  const bands = SETTING_BANDS.map((band) => ({
    key: band.key,
    groups: band.groups.filter((g) => settingGroups().includes(g)),
  })).filter((band) => band.groups.length > 0);
  return leftovers.length > 0 ? [...bands, { key: "other", groups: leftovers }] : bands;
}

/** How many settings a section holds — the only thing the index needs to count. */
export function settingCount(group: string): number {
  return Object.values(settingDefinitions).filter((def) => (def as { group: string }).group === group).length;
}

/**
 * A section's name and its one line of explanation.
 *
 * Both fall back to the group's own key rather than printing `settingGroup.x`
 * at an operator, which is the same rule a field's label follows.
 */
export function groupTitle(group: string, t: Translator): string {
  const named = t(`settingGroup.${group}`);
  return named === `settingGroup.${group}` ? group : named;
}

export function groupSummary(group: string, t: Translator): string {
  const named = t(`settingGroup.${group}.sub`);
  return named === `settingGroup.${group}.sub` ? "" : named;
}

/**
 * One section's fields, built from the registry.
 *
 * Lives here rather than in the page so the index and the section page agree
 * on what a group contains, and so adding a setting to the registry still
 * needs no edit to either.
 */
export function settingFields(group: string, t: Translator, current: Record<string, unknown>): SettingField[] {
  const fields: SettingField[] = [];

  for (const [key, def] of Object.entries(settingDefinitions)) {
    if ((def as { group: string }).group !== group) continue;

    // t() answers with the key when there is no entry, which is how a setting
    // added since is left to the form's derived name rather than showing
    // "setting.foo.bar" to an operator.
    const named = t(`setting.${key}`);
    const options = (def as { options?: readonly string[] }).options;

    fields.push({
      key,
      label: named === `setting.${key}` ? "" : named,
      // The image control needs its own three, and only it uses them.
      hint: t("setting.imageHint"),
      uploadLabel: t("admin.upload"),
      removeLabel: t("admin.remove"),
      type: (def as { type: string }).type,
      options: options ? [...options] : undefined,
      // A stored value like "priceBoard" is a code, not a word. Where the
      // dictionary names one, the operator reads the name; where it does not,
      // the code stands in rather than an empty option.
      optionLabels: options
        ? Object.fromEntries(
            options.map((o) => {
              const label = t(`settingOption.${key}.${o}`);
              return [o, label === `settingOption.${key}.${o}` ? o : label];
            }),
          )
        : undefined,
      value: current[key],
    });
  }

  return fields;
}
