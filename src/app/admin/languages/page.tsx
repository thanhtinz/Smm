import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { bundledDictionaries, en } from "@/lib/dictionaries";
import LanguageManager from "@/components/admin/language-manager";

export const metadata: Metadata = { title: "Languages" };

export default async function AdminLanguagesPage() {
  const { t } = await getAppContext();

  const languages = await db.language.findMany({
    orderBy: [{ position: "asc" }, { code: "asc" }],
    include: { strings: true },
  });

  const base = en as unknown as Record<string, string>;
  const keys = Object.keys(base).sort();

  // What the user actually sees today for each key: the language's own
  // bundled strings first, English only where that language has none.
  const values: Record<string, Record<string, string>> = {};
  const fallbacks: Record<string, Record<string, string>> = {};
  const covered: Record<string, number> = {};

  for (const lang of languages) {
    const bundled = bundledDictionaries[lang.code] ?? {};
    values[lang.id] = Object.fromEntries(lang.strings.map((s) => [s.key, s.value]));
    fallbacks[lang.id] = Object.fromEntries(keys.map((k) => [k, bundled[k] ?? base[k]]));
    covered[lang.id] = keys.filter((k) => values[lang.id][k] !== undefined || bundled[k] !== undefined).length;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <LanguageManager
        keys={keys}
        fallbacks={fallbacks}
        values={values}
        rows={languages.map((l) => ({
          id: l.id,
          code: l.code,
          name: l.name,
          nativeName: l.nativeName,
          direction: l.direction,
          enabled: l.enabled,
          position: l.position,
          translatedCount: covered[l.id] ?? 0,
        }))}
        labels={{
          close: t("common.close"),
          egNative: t("eg.nativeName"),
          egName: t("eg.languageName"),
          title: t("common.language"),
          new: t("admin.new"),
          edit: t("admin.edit"),
          delete: t("admin.delete"),
          confirmDelete: t("admin.confirmDelete"),
          code: t("admin.code"),
          name: t("admin.name"),
          nativeName: t("admin.nativeName"),
          direction: t("admin.direction"),
          position: t("admin.position"),
          enabled: t("admin.enabled"),
          disabled: t("admin.disabled"),
          status: t("common.status"),
          actions: t("common.actions"),
          translations: t("admin.translations"),
          searchKeys: t("admin.searchKeys"),
          fallbackHint: t("admin.fallbackHint"),
          save: t("common.save"),
          cancel: t("common.cancel"),
        }}
      />
    </div>
  );
}
