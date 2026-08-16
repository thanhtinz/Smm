import Link from "next/link";
import Logo from "@/components/logo";
import PreferenceMenu from "@/components/preference-menu";
import SiteLinks from "@/components/site-links";
import SiteMenu from "@/components/site-nav";
import { Icon } from "@/components/icons";
import type { AppContext } from "@/lib/context";
import { db } from "@/lib/db";

export default async function SiteHeader({
  ctx,
  preferences = true,
}: {
  ctx: AppContext;
  /**
   * Every display choice at once — language, currency, theme and the
   * light/dark switch. Off on the landing page, which is set by whoever runs
   * the panel rather than by whoever is reading it: its language is pinned,
   * its colour mode belongs to the layout, and a currency picker on a page
   * with one price on it is a control looking for a job. All four are there
   * the moment a visitor signs in.
   */
  preferences?: boolean;
}) {
  const { t, user, settings } = ctx;

  // The blog is offered only once there is something in it: a header link to
  // an empty page is worse than no header link.
  const posts = await db.blogPost.count({ where: { publishedAt: { not: null, lte: new Date() } } });

  const links = [
    { href: "/", label: t("nav.home") },
    { href: "/api-docs", label: t("nav.api") },
    ...(posts > 0 ? [{ href: "/blog", label: t("blog.title") }] : []),
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

        <div className="ms-2 min-w-0 flex-1">
          <SiteLinks links={links} />
        </div>

        <div className="ms-auto flex shrink-0 items-center gap-2">
          {preferences && <PreferenceMenu
            languages={ctx.languages}
            currencies={ctx.currencies}
            themes={ctx.themes}
            locale={ctx.locale}
            currency={ctx.currency.code}
            theme={ctx.theme}
            mode={ctx.mode}
            labels={prefLabels}
          />}
          <div className="hidden items-center gap-2 sm:flex">{account}</div>

          {/* Below md the links, the preferences and the account buttons all
              live in one sheet behind this. */}
          <div className="md:hidden">
            <SiteMenu links={links} labels={{ open: t("nav.menu"), close: t("common.close") }}>
              {/* Account first: signing in is what most of the people opening
                  this came for, and the option lists below run long. */}
              <div className="flex flex-col gap-2 sm:hidden">{account}</div>
              {preferences && <PreferenceMenu
                languages={ctx.languages}
                currencies={ctx.currencies}
                themes={ctx.themes}
                locale={ctx.locale}
                currency={ctx.currency.code}
                theme={ctx.theme}
                mode={ctx.mode}
                labels={prefLabels}
                stacked
              />}
            </SiteMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
