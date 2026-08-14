import type { Metadata } from "next";
import "./globals.css";
import ThemeStyles from "@/components/theme-styles";
import { getAppContext } from "@/lib/context";
import { getSetting } from "@/lib/settings";
import { getCurrentPanel } from "@/lib/tenancy";

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
      <html lang="en" suppressHydrationWarning>
        <body>{children}</body>
      </html>
    );
  }

  const { theme, mode, locale } = await getAppContext();
  return (
    <html lang={locale} data-theme={theme} data-mode={mode} suppressHydrationWarning>
      <head>
        <ThemeStyles />
      </head>
      <body>{children}</body>
    </html>
  );
}
