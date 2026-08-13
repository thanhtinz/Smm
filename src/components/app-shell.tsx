import Link from "next/link";
import Logo from "@/components/logo";
import PreferenceMenu from "@/components/preference-menu";
import UserMenu from "@/components/user-menu";
import MobileNav from "@/components/mobile-nav";
import NavLink from "@/components/nav-link";
import { Icon, type IconName } from "@/components/icons";
import { displayMoney } from "@/lib/currency";
import type { AppContext } from "@/lib/context";

export type NavItem = { href: string; label: string; icon: IconName; badge?: number; exact?: boolean };
export type NavGroup = { title: string; items: NavItem[] };

/**
 * Shared chrome for every signed-in area. The sidebar is the single primary
 * navigation; on small screens it collapses into a bottom bar capped at five
 * destinations so the back behaviour stays predictable.
 */
export default function AppShell({
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

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      {/* ------------------------------------------------------- sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_55%,transparent)] lg:flex">
        <div className="flex h-16 shrink-0 items-center px-5">
          <Link href="/" className="ring-focus rounded-lg">
            <Logo text={settings["site.logoText"] as string} size={30} />
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
              <Logo text={settings["site.logoText"] as string} size={28} />
            </span>
            <h1 className="hidden text-base font-semibold lg:block">{title}</h1>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/dashboard/wallet" className="badge badge-muted">
              <Icon name="wallet" size={13} />
              {displayMoney(user.balance, ctx.currency, ctx.locale)}
            </Link>
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
            <UserMenu
              username={user.username}
              email={user.email}
              role={user.role}
              languages={ctx.languages}
              currencies={ctx.currencies}
              themes={ctx.themes}
              locale={ctx.locale}
              currency={ctx.currency.code}
              theme={ctx.theme}
              mode={ctx.mode}
            />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:pb-10">{children}</main>

        <MobileNav items={primaryMobile} />
      </div>
    </div>
  );
}
