import { db } from "./db";
import { getSetting } from "./settings";
import { builtinThemes, type ThemeTokens } from "./themes";

export type PanelChrome = {
  /** The colour a launcher paints the title bar and splash screen with. */
  primary: string;
  background: string;
  foreground: string;
  direction: "ltr" | "rtl";
};

const FALLBACK: PanelChrome = { primary: "#8b5cf6", background: "#0a0a14", foreground: "#ffffff", direction: "ltr" };

/**
 * The colours an installed panel wears, taken from the skin and colour mode
 * the operator set as the panel's default.
 *
 * The reader's own theme deliberately does not come into it. A manifest is
 * read once, when the icon is added to the home screen, and the splash screen
 * it produces is baked in then — following a cookie would mean the app's
 * colours were decided by whichever mode the reader happened to be in that
 * afternoon, for good.
 */
export async function panelTheme(): Promise<PanelChrome> {
  const [slug, mode, locale] = await Promise.all([
    getSetting("appearance.defaultTheme"),
    getSetting("appearance.defaultColorMode"),
    getSetting("locale.default"),
  ]);

  // "system" is a question asked of a browser, and there is no browser here.
  // Dark is what the panel ships as and what every bundled skin is drawn for.
  const wanted: "dark" | "light" = mode === "light" ? "light" : "dark";

  const tokens = await themeTokens(String(slug || ""));
  if (!tokens) return { ...FALLBACK, direction: await localeDirection(String(locale || "en")) };

  const palette = tokens[wanted] ?? tokens.dark ?? {};
  return {
    primary: palette.primary || FALLBACK.primary,
    background: palette.bg || FALLBACK.background,
    foreground: palette.primaryFg || FALLBACK.foreground,
    direction: await localeDirection(String(locale || "en")),
  };
}

/** The stored skin, falling back to the bundled one of the same name. */
async function themeTokens(slug: string): Promise<ThemeTokens | null> {
  const row = slug
    ? await db.theme.findFirst({ where: { slug, enabled: true }, select: { tokens: true } })
    : await db.theme.findFirst({ where: { enabled: true, isDefault: true }, select: { tokens: true } });

  if (row) {
    try {
      return JSON.parse(row.tokens) as ThemeTokens;
    } catch {
      // A skin whose tokens no longer parse is a broken skin, not a reason to
      // stop being installable.
    }
  }
  return builtinThemes.find((t) => t.slug === slug)?.tokens ?? builtinThemes[0]?.tokens ?? null;
}

async function localeDirection(code: string): Promise<"ltr" | "rtl"> {
  const language = await db.language.findFirst({ where: { code }, select: { direction: true } });
  return language?.direction === "rtl" ? "rtl" : "ltr";
}
