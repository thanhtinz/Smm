import type { Metadata } from "next";
import { Be_Vietnam_Pro, Playfair_Display, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import ThemeStyles from "@/components/theme-styles";
import { getAppContext } from "@/lib/context";
import { getSetting } from "@/lib/settings";
import { getCurrentPanel } from "@/lib/tenancy";

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
  const [name, tagline, description, favicon] = await Promise.all([
    getSetting("site.name"),
    getSetting("site.tagline"),
    getSetting("site.description"),
    getSetting("site.faviconUrl"),
  ]);

  return {
    title: { default: [name, tagline].filter(Boolean).join(" · "), template: `%s · ${name}` },
    description: description as string,
    // Only when one is set — Next falls back to /favicon.ico otherwise, and
    // an empty icons entry would suppress that.
    ...(favicon ? { icons: { icon: favicon as string } } : {}),
    openGraph: {
      title: name as string,
      description: (tagline as string) || (description as string),
      ...(favicon ? { images: [favicon as string] } : {}),
    },
  };
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

  const { theme, mode, locale } = await getAppContext();
  return (
    <html lang={locale} className={fontVars} data-theme={theme} data-mode={mode} suppressHydrationWarning>
      <head>
        <ThemeStyles />
      </head>
      <body>{children}</body>
    </html>
  );
}
