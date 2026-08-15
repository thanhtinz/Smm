import { db } from "./db";
import { bundledDictionaries, en, type TranslationKey } from "./dictionaries";
import { getSetting } from "./settings";

export type Translator = (key: TranslationKey | string, vars?: Record<string, string | number>) => string;

const cache = new Map<string, { at: number; dict: Record<string, string> }>();
const TTL = 5_000;

export async function getEnabledLanguages() {
  const rows = await db.language.findMany({
    where: { enabled: true },
    orderBy: [{ position: "asc" }, { code: "asc" }],
  });
  return rows;
}

export async function loadDictionary(locale: string): Promise<Record<string, string>> {
  const hit = cache.get(locale);
  if (hit && Date.now() - hit.at < TTL) return hit.dict;

  const dict: Record<string, string> = { ...(en as unknown as Record<string, string>) };
  Object.assign(dict, bundledDictionaries[locale] ?? {});

  const lang = await db.language.findUnique({
    where: { code: locale },
    include: { strings: true },
  });
  if (lang) for (const row of lang.strings) dict[row.key] = row.value;

  cache.set(locale, { at: Date.now(), dict });
  return dict;
}

export function invalidateDictionaries() {
  cache.clear();
}

/** Builds a translator bound to a locale, with {placeholder} interpolation. */
export async function getTranslator(locale?: string): Promise<{ t: Translator; locale: string }> {
  const resolved = locale || (await getSetting("locale.default"));
  const dict = await loadDictionary(resolved);
  const t: Translator = (key, vars) => {
    // "1 services" is what a count string says when nobody thought about one
    // of them. A key may add a `.one` twin and it is used whenever `n` is
    // exactly 1; keys that do not care — and every string in a language that
    // does not inflect, which is most of this dictionary — are untouched.
    // The count arrives already formatted for the reader — "1" here, "1.000"
    // in Vietnamese for a thousand — so the check is against the rendered
    // one rather than a parse. Number("1.000") is 1 in JavaScript, which
    // would have called a thousand singular on a Vietnamese page.
    const one = vars?.n === 1 || vars?.n === "1" ? `${key as string}.one` : "";
    const chosen = one && (dict[one] ?? (en as Record<string, string>)[one]) ? one : (key as string);

    let out = dict[chosen] ?? (en as Record<string, string>)[chosen] ?? (key as string);
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
    return out;
  };
  return { t, locale: resolved };
}
