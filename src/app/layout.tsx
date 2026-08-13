import type { Metadata } from "next";
import "./globals.css";
import ThemeStyles from "@/components/theme-styles";
import { getAppContext } from "@/lib/context";
import { getSetting } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const [name, description] = await Promise.all([getSetting("site.name"), getSetting("site.description")]);
  return {
    title: { default: name as string, template: `%s · ${name}` },
    description: description as string,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
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
