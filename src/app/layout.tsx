import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Playfair_Display, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import ThemeStyles from "@/components/theme-styles";
import { getAppContext } from "@/lib/context";
import { getSetting } from "@/lib/settings";
import { isIndexable } from "@/lib/seo";
import { getCurrentPanel, panelBaseUrl } from "@/lib/tenancy";
import { headers } from "next/headers";
import { PATHNAME_HEADER } from "@/lib/panel-host";
import { LANDING_MODE, chosenLayout } from "@/lib/landing";
import { MANIFEST_PATH } from "@/lib/pwa";
import { panelTheme } from "@/lib/pwa-server";
import RegisterServiceWorker from "@/components/pwa/register";

/**
 * The panel's faces.
 *
 * Be Vietnam Pro is drawn for Vietnamese, which is the point: most grotesks
 * treat the stacked diacritics as an afterthought and the text sets badly at
 * display sizes. It carries the whole interface.
 *
 * Playfair is only for the editorial landing, and JetBrains Mono only for
 * figures that want to line up — prices, counts, IDs. Both are loaded here so
 * a theme can point --font-display or --font-mono at them without the page
 * that uses them having to arrange its own download.
 */
const bodyFont = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-be-vietnam",
  display: "swap",
});

const displayFont = Playfair_Display({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
  variable: "--font-playfair",
  display: "swap",
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-jetbrains",
  display: "swap",
});

const fontVars = `${bodyFont.variable} ${displayFont.variable} ${monoFont.variable}`;

export async function generateMetadata(): Promise<Metadata> {
  if (!(await getCurrentPanel())) return { title: "Not found" };
  const [name, tagline, description, favicon, indexable, google, bing, base, installable, appName, shortName] =
    await Promise.all([
      getSetting("site.name"),
      getSetting("site.tagline"),
      getSetting("site.description"),
      getSetting("site.faviconUrl"),
      isIndexable(),
      getSetting("seo.googleVerification"),
      getSetting("seo.bingVerification"),
      panelBaseUrl(),
      getSetting("pwa.enabled"),
      getSetting("pwa.name"),
      getSetting("pwa.shortName"),
    ]);

  return {
    // Every relative URL below and in every page resolves against the panel's
    // own hostname, which is the only way canonicals work on a multi-tenant
    // deployment.
    metadataBase: new URL(base),
    title: { default: [name, tagline].filter(Boolean).join(" · "), template: `%s · ${name}` },
    description: description as string,
    // The operator's switch reaches the pages themselves, not just robots.txt:
    // a page already in an index leaves faster for noindex than for a rule it
    // is no longer allowed to fetch.
    ...(indexable ? {} : { robots: { index: false, follow: false } }),
    ...(google || bing
      ? { verification: { ...(google ? { google: google as string } : {}), ...(bing ? { other: { "msvalidate.01": bing as string } } : {}) } }
      : {}),
    // Only when one is set — Next falls back to /favicon.ico otherwise, and
    // an empty icons entry would suppress that.
    ...(favicon ? { icons: { icon: favicon as string } } : {}),
    // Only when the operator has left it on — the link is what makes a browser
    // fetch the manifest, and a link to a route answering 404 is a console
    // error on every page of the panel.
    ...(installable
      ? {
          manifest: MANIFEST_PATH,
          appleWebApp: {
            capable: true,
            // Safari reads this and nothing else for the name under the icon.
            title: String(appName || shortName || name || ""),
            // The panel paints its own background behind the status bar, so
            // the bar should not paint one of its own on top of it.
            statusBarStyle: "black-translucent",
          },
        }
      : {}),
    openGraph: {
      title: name as string,
      description: (tagline as string) || (description as string),
      ...(favicon ? { images: [favicon as string] } : {}),
    },
  };
}

/**
 * The colour a browser paints its own chrome with — the address bar on
 * Android, the area behind the status bar in an installed app.
 *
 * The panel's default skin, not the reader's: this is read before any of the
 * page is, and a value that followed a cookie would flash the wrong colour on
 * every first paint.
 */
export async function generateViewport(): Promise<Viewport> {
  if (!(await getCurrentPanel())) return {};
  const theme = await panelTheme();
  return { themeColor: theme.background };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Settings, themes and translations are all panel-scoped, so on a host we do
  // not serve there is nothing to read. The segment layouts turn that into a
  // 404; this only has to render a shell for it.
  if (!(await getCurrentPanel())) {
    return (
      <html lang="en" className={fontVars} suppressHydrationWarning>
        <body>{children}</body>
      </html>
    );
  }

  const ctx = await getAppContext();
  const { theme, locale, direction } = ctx;

  // The home page is drawn for one background — see LANDING_MODE — so it
  // overrules the reader's light/dark preference there and only there. The
  // switch is hidden on that page too: a control that changes nothing is
  // worse than no control.
  const path = (await headers()).get(PATHNAME_HEADER) ?? "";
  const mode = path === "/" ? LANDING_MODE[chosenLayout(ctx.settings)] : ctx.mode;

  return (
    <html
      lang={locale}
      dir={direction}
      className={fontVars}
      data-theme={theme}
      data-mode={mode}
      suppressHydrationWarning
    >
      <head>
        <ThemeStyles />
      </head>
      <body>
        {children}
        <RegisterServiceWorker enabled={Boolean(ctx.settings["pwa.enabled"]) && Boolean(ctx.settings["pwa.offline"])} />
      </body>
    </html>
  );
}
