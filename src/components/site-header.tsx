import Link from "next/link";
import Logo from "@/components/logo";
import PreferenceMenu from "@/components/preference-menu";
import { Icon } from "@/components/icons";
import type { AppContext } from "@/lib/context";

export default function SiteHeader({ ctx }: { ctx: AppContext }) {
  const { t, user, settings } = ctx;
  const nav = [
    { href: "/", label: t("nav.home") },
    { href: "/services", label: t("nav.services") },
    { href: "/api-docs", label: t("nav.api") },
    { href: "/p/terms", label: t("nav.terms") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="ring-focus rounded-lg">
            <Logo text={settings["site.logoText"] as string} image={settings["site.logoUrl"] as string} />
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="muted rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface2)] hover:text-[var(--text)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <PreferenceMenu
              languages={ctx.languages}
              currencies={ctx.currencies}
              themes={ctx.themes}
              locale={ctx.locale}
              currency={ctx.currency.code}
              theme={ctx.theme}
              mode={ctx.mode}
            />
          </div>
          {user ? (
            <Link href="/dashboard" className="btn btn-primary btn-sm">
              <Icon name="dashboard" size={16} />
              {t("nav.dashboard")}
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">
                {t("nav.signin")}
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm">
                {t("nav.signup")}
                <Icon name="arrowRight" size={15} />
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
