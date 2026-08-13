import { cookies } from "next/headers";
import { db } from "./db";
import { getCurrentUser } from "./auth";
import { getSetting, getSettings } from "./settings";
import { getTranslator, getEnabledLanguages, type Translator } from "./i18n";
import { getCurrencies, resolveCurrency, getBaseCurrency, type CurrencyInfo } from "./currency";

export const LOCALE_COOKIE = "nova_locale";
export const CURRENCY_COOKIE = "nova_currency";
export const THEME_COOKIE = "nova_theme";
export const MODE_COOKIE = "nova_mode";

export type AppContext = {
  user: Awaited<ReturnType<typeof getCurrentUser>>;
  t: Translator;
  locale: string;
  languages: Awaited<ReturnType<typeof getEnabledLanguages>>;
  currency: CurrencyInfo;
  baseCurrency: CurrencyInfo;
  currencies: CurrencyInfo[];
  theme: string;
  mode: "dark" | "light";
  themes: { slug: string; name: string; description: string }[];
  settings: Record<string, unknown>;
};

/**
 * Resolution order for every preference: signed-in user profile, then cookie,
 * then the admin-configured default.
 */
export async function getAppContext(): Promise<AppContext> {
  const jar = await cookies();
  const [user, settings, languages, currencies, baseCurrency] = await Promise.all([
    getCurrentUser(),
    getSettings(),
    getEnabledLanguages(),
    getCurrencies(),
    getBaseCurrency(),
  ]);

  const allowLocale = settings["locale.allowUserLocale"] !== false;
  const localeCandidate = allowLocale
    ? user?.locale || jar.get(LOCALE_COOKIE)?.value || (settings["locale.default"] as string)
    : (settings["locale.default"] as string);
  const locale = languages.some((l) => l.code === localeCandidate)
    ? localeCandidate
    : languages[0]?.code || "en";

  const allowCurrency = settings["currency.allowUserCurrency"] !== false;
  const currencyCode = allowCurrency
    ? user?.currency || jar.get(CURRENCY_COOKIE)?.value || (settings["currency.display"] as string)
    : (settings["currency.display"] as string);

  const themeRows = await db.theme.findMany({
    where: { enabled: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { slug: true, name: true, description: true },
  });

  const allowTheme = settings["appearance.allowUserTheme"] !== false;
  const themeCandidate = allowTheme
    ? user?.theme || jar.get(THEME_COOKIE)?.value || (settings["appearance.defaultTheme"] as string)
    : (settings["appearance.defaultTheme"] as string);
  const theme = themeRows.some((r) => r.slug === themeCandidate) ? themeCandidate : themeRows[0]?.slug || "aurora";

  const modeRaw = allowTheme
    ? user?.colorMode || jar.get(MODE_COOKIE)?.value || (settings["appearance.defaultColorMode"] as string)
    : (settings["appearance.defaultColorMode"] as string);
  const mode: "dark" | "light" = modeRaw === "light" ? "light" : "dark";

  const [{ t }, currency] = await Promise.all([getTranslator(locale), resolveCurrency(currencyCode)]);

  return {
    user,
    t,
    locale,
    languages,
    currency,
    baseCurrency,
    currencies,
    theme,
    mode,
    themes: themeRows,
    settings,
  };
}

export async function siteName() {
  return (await getSetting("site.name")) as string;
}
