import Link from "next/link";
import Logo from "@/components/logo";
import PlatformMark from "@/components/platform-mark";
import { db } from "@/lib/db";
import PreferenceMenu from "@/components/preference-menu";
import SiteLinks from "@/components/site-links";
import SiteMenu from "@/components/site-nav";
import { Icon } from "@/components/icons";
import type { AppContext } from "@/lib/context";
import type { NavLink } from "@/components/site-nav";

export default async function SiteHeader({ ctx }: { ctx: AppContext }) {
  const { t, user, settings } = ctx;

  /**
   * A platform per entry, its categories inside it.
   *
   * This is the shape this market's customers already know: they arrive
   * knowing the platform and the thing they want done to it, and the menu is
   * where they say both. A single "Services" link makes them find the
   * platform, then find the category, on a page — two steps the bar can just
   * do. Platforms with nothing on sale are left out rather than opening onto
   * an empty panel.
   */
  const platforms = await db.platform.findMany({
    where: { visible: true, categories: { some: { visible: true, services: { some: { enabled: true } } } } },
    orderBy: { position: "asc" },
    select: {
      slug: true,
      name: true,
      icon: true,
      image: true,
      color: true,
      categories: {
        where: { visible: true, services: { some: { enabled: true } } },
        orderBy: [{ position: "asc" }, { name: "asc" }],
        select: { slug: true, name: true },
      },
    },
  });

  const links: NavLink[] = [
    ...platforms.map((p) => ({
      href: `/services/${p.slug}`,
      label: p.name,
      icon: <PlatformMark platform={p} size={16} />,
      allLabel: t("nav.allOf", { name: p.name }),
      children: p.categories.map((c) => ({
        href: `/services/${p.slug}/${c.slug}`,
        label: c.name,
      })),
    })),
    { href: "/services", label: t("nav.services") },
    { href: "/api-docs", label: t("nav.api") },
    { href: "/p/terms", label: t("nav.terms") },
  ];

  // The sheet is a whole screen, so it keeps the entry the bar drops: the
  // logo is the way home on a wide screen, and a hard thing to find on a
  // phone menu that never names it.
  const sheetLinks: NavLink[] = [{ href: "/", label: t("nav.home") }, ...links];

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
          <SiteLinks links={links} moreLabel={t("nav.more")} />
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
            labels={prefLabels}
          />
          <div className="hidden items-center gap-2 sm:flex">{account}</div>

          {/* Below md the links, the preferences and the account buttons all
              live in one sheet behind this. */}
          <div className="md:hidden">
            <SiteMenu links={sheetLinks} labels={{ open: t("nav.menu"), close: t("common.close") }}>
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
