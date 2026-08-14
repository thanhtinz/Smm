import Link from "next/link";
import Logo from "@/components/logo";
import PreferenceMenu from "@/components/preference-menu";
import UserMenu from "@/components/user-menu";
import MobileNav from "@/components/mobile-nav";
import NavLink from "@/components/nav-link";
import NotificationBell, { type BellItem } from "@/components/notification-bell";
import { Icon, type IconName } from "@/components/icons";
import { db } from "@/lib/db";
import { dateFormats } from "@/lib/dates";
import { displayMoney } from "@/lib/currency";
import type { AppContext } from "@/lib/context";

export type NavItem = { href: string; label: string; icon: IconName; badge?: number; exact?: boolean };
export type NavGroup = { title: string; items: NavItem[] };

/**
 * Shared chrome for every signed-in area. The sidebar is the single primary
 * navigation; on small screens it collapses into a bottom bar capped at five
 * destinations so the back behaviour stays predictable.
 */
export default async function AppShell({
  ctx,
  groups,
  children,
  title,
  primaryMobile,
}: {
  ctx: AppContext;
  groups: NavGroup[];
  children: React.ReactNode;
  title: string;
  primaryMobile: NavItem[];
}) {
  const { user, t, settings } = ctx;
  if (!user) return null;

  const dates = dateFormats(ctx.locale, ctx.timezone);
  const [recent, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  const bellItems: BellItem[] = recent.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    level: n.level,
    read: n.read,
    href: n.href,
    when: dates.full(n.createdAt),
  }));

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      {/* ------------------------------------------------------- sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_55%,transparent)] lg:flex">
        <div className="flex h-16 shrink-0 items-center px-5">
          <Link href="/" className="ring-focus rounded-lg">
            <Logo text={settings["site.logoText"] as string} image={settings["site.logoUrl"] as string} size={30} />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label={title}>
          {groups.map((group) => (
            <div key={group.title} className="mb-5">
              <p className="muted px-3 pb-2 text-[0.67rem] font-semibold tracking-widest uppercase">{group.title}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <NavLink {...item} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-[var(--border)] p-3">
          <Link href="/dashboard/wallet" className="card card-pad block !p-3.5 transition-colors hover:bg-[var(--surface2)]">
            <span className="muted flex items-center gap-1.5 text-[0.68rem] font-semibold tracking-widest uppercase">
              <Icon name="wallet" size={13} />
              {t("common.balance")}
            </span>
            <span className="mt-1.5 block text-lg font-bold">
              {displayMoney(user.balance, ctx.currency, ctx.locale)}
            </span>
          </Link>
        </div>
      </aside>

      {/* --------------------------------------------------------- main */}
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_86%,transparent)] px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <span className="lg:hidden">
              <Logo text={settings["site.logoText"] as string} image={settings["site.logoUrl"] as string} size={28} />
            </span>
            <h1 className="hidden text-base font-semibold lg:block">{title}</h1>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/dashboard/wallet" className="badge badge-muted">
              <Icon name="wallet" size={13} />
              {displayMoney(user.balance, ctx.currency, ctx.locale)}
            </Link>
            <NotificationBell
              items={bellItems}
              unread={unread}
              labels={{
                title: t("dash.notifications"),
                empty: t("notify.empty"),
                markAll: t("notify.markAll"),
                seeAll: t("notify.seeAll"),
                unread: t("notify.unread"),
              }}
            />
            {/* Signed in, the pickers live in the account page — only the
                light/dark switch is worth a place in the header. */}
            <PreferenceMenu
              languages={ctx.languages}
              currencies={ctx.currencies}
              themes={ctx.themes}
              locale={ctx.locale}
              currency={ctx.currency.code}
              theme={ctx.theme}
              mode={ctx.mode}
              showPickers={false}
              labels={{
                language: t("common.language"),
                currency: t("common.currency"),
                theme: t("common.theme"),
                display: t("profile.preferences"),
                mode: t("common.appearance"),
              }}
            />
            <UserMenu
              username={user.username}
              email={user.email}
              role={user.role}
              labels={{
                profile: t("nav.profile"),
                wallet: t("nav.wallet"),
                apiKey: t("api.key"),
                admin: t("admin.title"),
                signOut: t("nav.signout"),
              }}
            />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:pb-10">{children}</main>

        <MobileNav items={primaryMobile} />
      </div>
    </div>
  );
}
