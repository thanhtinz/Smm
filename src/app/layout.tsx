import type { Metadata } from "next";
import "./globals.css";
import ThemeStyles from "@/components/theme-styles";
import { getAppContext } from "@/lib/context";
import { getSetting } from "@/lib/settings";
import { getCurrentPanel } from "@/lib/tenancy";

export async function generateMetadata(): Promise<Metadata> {
  if (!(await getCurrentPanel())) return { title: "Not found" };
  const [name, description] = await Promise.all([getSetting("site.name"), getSetting("site.description")]);
  return {
    title: { default: name as string, template: `%s · ${name}` },
    description: description as string,
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
