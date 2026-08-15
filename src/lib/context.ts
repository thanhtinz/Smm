import { cookies, headers } from "next/headers";
import { db } from "./db";
import { getCurrentUser } from "./auth";
import { getSetting, getSettings } from "./settings";
import { getTranslator, getEnabledLanguages, type Translator } from "./i18n";
import { getCurrencies, resolveCurrency, getBaseCurrency, type CurrencyInfo } from "./currency";
import { PATHNAME_HEADER } from "./panel-host";

export const LOCALE_COOKIE = "nova_locale";
export const CURRENCY_COOKIE = "nova_currency";
export const THEME_COOKIE = "nova_theme";
export const MODE_COOKIE = "nova_mode";
export const TIMEZONE_COOKIE = "nova_tz";

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
  /** IANA name every date on the page is rendered in. */
  timezone: string;
  themes: { slug: string; name: string; description: string }[];
  settings: Record<string, unknown>;
};

/**
 * A name Intl actually knows. An unknown one throws at format time rather
 * than when it was saved, which would take a page down long after the typo.
 */
function validTimezone(name: string): boolean {
  if (!name) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

/**
 * The language this reader gets, by the same rule as every other preference:
 * signed-in profile, then cookie, then the admin default — unless the panel
 * pins one for everyone.
 *
 * Split out of getAppContext so a server action can translate the sentence it
 * hands back without loading currencies, themes and the whole settings map.
 */
export async function readerLocale(): Promise<string> {
  const [jar, user, languages, allow, fallback] = await Promise.all([
    cookies(),
    getCurrentUser(),
    getEnabledLanguages(),
    getSetting("locale.allowUserLocale"),
    getSetting("locale.default"),
  ]);
  const candidate = allow
    ? user?.locale || jar.get(LOCALE_COOKIE)?.value || (fallback as string)
    : (fallback as string);
  return languages.some((l) => l.code === candidate) ? candidate : languages[0]?.code || "en";
}

/**
 * The translator for whoever is reading. Server actions answer with sentences
 * a person reads, so those sentences are looked up like any other string
 * rather than written into the code in one language.
 */
export async function readerMessages(): Promise<Translator> {
  return (await readerText()).t;
}

/**
 * The same, with the locale kept.
 *
 * A refusal that quotes a number — a minimum deposit, a maximum quantity —
 * has to group its digits the reader's way too, and the translator alone does
 * not say which way that is.
 */
export async function readerText(): Promise<{ t: Translator; locale: string }> {
  return getTranslator(await readerLocale());
}

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
  const resolvedLocale = languages.some((l) => l.code === localeCandidate)
    ? localeCandidate
    : languages[0]?.code || "en";

  // The home page is fixed to one language — `landing.locale`, English out of
  // the box. Resolved here rather than in the page so the header, the footer
  // and the page itself cannot end up in two different languages, and so the
  // switch that would fight it can be hidden from the same fact.
  const onLanding = ((await headers()).get(PATHNAME_HEADER) ?? "") === "/";
  const landingLocale = String(settings["landing.locale"] ?? "en");
  const locale =
    onLanding && languages.some((l) => l.code === landingLocale) ? landingLocale : resolvedLocale;

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

  const allowTimezone = settings["locale.allowUserTimezone"] !== false;
  const zoneCandidate = allowTimezone
    ? user?.timezone || jar.get(TIMEZONE_COOKIE)?.value || (settings["locale.timezone"] as string)
    : (settings["locale.timezone"] as string);
  const timezone = validTimezone(zoneCandidate) ? zoneCandidate : "UTC";

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
    timezone,
    themes: themeRows,
    settings,
  };
}

export async function siteName() {
  return (await getSetting("site.name")) as string;
}
