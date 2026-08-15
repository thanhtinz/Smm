import Link from "next/link";
import Logo from "@/components/logo";
import PreferenceMenu from "@/components/preference-menu";
import SiteLinks from "@/components/site-links";
import SiteMenu from "@/components/site-nav";
import { Icon } from "@/components/icons";
import type { AppContext } from "@/lib/context";

export default function SiteHeader({
  ctx,
  showMode = true,
  showLanguage = true,
}: {
  ctx: AppContext;
  showMode?: boolean;
  showLanguage?: boolean;
}) {
  const { t, user, settings } = ctx;

  const links = [
    { href: "/", label: t("nav.home") },
    { href: "/api-docs", label: t("nav.api") },
    { href: "/p/terms", label: t("nav.terms") },
  ];

  const prefLabels = {
    language: t("common.language"),
    currency: t("common.currency"),
    theme: t("common.theme"),
    display: t("profile.preferences"),
    mode: t("common.appearance"),
  };

  const account = user ? (
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
  );

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] backdrop-blur-xl">
      <div className="container-page flex h-16 items-center gap-3">
        {/* Shrinks first when the row is tight: a clipped logo costs less
            than a wrapped nav or a hidden sign-up button. */}
        <Link href="/" className="ring-focus min-w-0 shrink rounded-lg">
          <Logo text={settings["site.logoText"] as string} image={settings["site.logoUrl"] as string} />
        </Link>

        <div className="ml-2 min-w-0 flex-1">
          <SiteLinks links={links} />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <PreferenceMenu
            languages={ctx.languages}
            currencies={ctx.currencies}
            themes={ctx.themes}
            locale={ctx.locale}
            currency={ctx.currency.code}
            theme={ctx.theme}
            mode={ctx.mode}
            showMode={showMode}
            showLanguage={showLanguage}
            labels={prefLabels}
          />
          <div className="hidden items-center gap-2 sm:flex">{account}</div>

          {/* Below md the links, the preferences and the account buttons all
              live in one sheet behind this. */}
          <div className="md:hidden">
            <SiteMenu links={links} labels={{ open: t("nav.menu"), close: t("common.close") }}>
              {/* Account first: signing in is what most of the people opening
                  this came for, and the option lists below run long. */}
              <div className="flex flex-col gap-2 sm:hidden">{account}</div>
              <PreferenceMenu
                languages={ctx.languages}
                currencies={ctx.currencies}
                themes={ctx.themes}
                locale={ctx.locale}
                currency={ctx.currency.code}
                theme={ctx.theme}
                mode={ctx.mode}
                showMode={showMode}
                showLanguage={showLanguage}
                labels={prefLabels}
                stacked
              />
            </SiteMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
