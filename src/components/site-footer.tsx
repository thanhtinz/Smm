import Link from "next/link";
import Logo from "@/components/logo";
import { Icon, type IconName } from "@/components/icons";
import { db } from "@/lib/db";
import type { AppContext } from "@/lib/context";

export default async function SiteFooter({ ctx }: { ctx: AppContext }) {
  const { t, settings } = ctx;
  const pages = await db.page.findMany({
    where: { published: true, showInFooter: true },
    orderBy: { position: "asc" },
    select: { slug: true, title: true },
  });

  const socials = (
    [
      { key: "site.telegram", icon: "telegram", href: settings["site.telegram"] as string },
      { key: "site.facebook", icon: "facebook", href: settings["site.facebook"] as string },
      { key: "site.whatsapp", icon: "mail", href: settings["site.whatsapp"] as string },
    ] satisfies { key: string; icon: IconName; href: string }[]
  ).filter((s) => s.href);

  return (
    <footer className="mt-24 border-t border-[var(--border)]">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo text={settings["site.logoText"] as string} image={settings["site.logoUrl"] as string} />
          <p className="muted mt-4 max-w-xs text-sm leading-relaxed">{settings["site.description"] as string}</p>
          {socials.length > 0 && (
            <div className="mt-5 flex gap-2">
              {socials.map((s) => (
                <a key={s.key} href={s.href} className="btn btn-ghost btn-sm" aria-label={s.key}>
                  <Icon name={s.icon} size={16} />
                </a>
              ))}
            </div>
          )}
        </div>

        <FooterCol title={t("nav.services")}>
          <FooterLink href="/services">{t("nav.services")}</FooterLink>
          <FooterLink href="/services">{t("nav.pricing")}</FooterLink>
          <FooterLink href="/api-docs">{t("nav.api")}</FooterLink>
        </FooterCol>

        <FooterCol title={t("nav.support")}>
          <FooterLink href="/dashboard/tickets">{t("nav.support")}</FooterLink>
          <FooterLink href={`mailto:${settings["site.supportEmail"]}`}>{settings["site.supportEmail"] as string}</FooterLink>
        </FooterCol>

        <FooterCol title={t("nav.legal")}>
          {pages.map((p) => (
            <FooterLink key={p.slug} href={`/p/${p.slug}`}>
              {p.title}
            </FooterLink>
          ))}
        </FooterCol>
      </div>

      <div className="border-t border-[var(--border)]">
        <div className="container-page muted flex flex-col items-center justify-between gap-2 py-5 text-xs sm:flex-row">
          <span>
            &copy; {new Date().getFullYear()} {settings["site.name"] as string}. {t("footer.rights")}
          </span>
          <span className="flex items-center gap-1.5">
            <Icon name="shield" size={14} />
            {t("footer.secure")}
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold tracking-widest uppercase">{title}</h3>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="muted text-sm transition-colors hover:text-[var(--text)]">
        {children}
      </Link>
    </li>
  );
}
