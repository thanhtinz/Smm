import Link from "next/link";
import { Icon } from "@/components/icons";
import PlatformMark from "@/components/platform-mark";
import { displayMoney } from "@/lib/currency";
import type { LandingProps } from "./types";

/**
 * Catalogue.
 *
 * A directory, not a pitch: every platform and every category it sells, on
 * one screen, each one a link straight into the filtered service list. The
 * visitor who already knows what they want never has to scroll past a
 * headline to find it, and the one who does not can see the whole shop at
 * once.
 */
export default function Catalogue({ data, t, currency, locale, settings }: LandingProps) {
  return (
    <>
      <section className="container-page flex flex-wrap items-center justify-between gap-4 pt-10 pb-6">
        <div>
          <h1 className="text-[2rem] leading-none font-extrabold tracking-[-0.03em] sm:text-[2.6rem]">{t("landing.catalogue.title")}</h1>
          <p className="muted mt-3">
            {t("landing.catalogue.sub", { services: data.serviceCount, platforms: data.platforms.length })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/services" className="btn btn-ghost">
            <Icon name="search" size={16} />
            {t("landing.cta.secondary")}
          </Link>
          <Link href="/register" className="btn btn-primary">
            {t("landing.cta.primary")}
            <Icon name="arrowRight" size={16} />
          </Link>
        </div>
      </section>

      <section className="container-page pb-14">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.platforms.map((p) => (
            <section key={p.id} className="card flex flex-col p-5">
              <div className="flex items-center gap-3">
                <PlatformMark platform={p} box={40} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold">
                    <Link href={`/services?platform=${p.slug}`} className="hover:text-[var(--primary)]">
                      {p.name}
                    </Link>
                  </h2>
                  <p className="muted font-mono text-xs">
                    {t("landing.catalogue.count", { n: p.services })}
                  </p>
                </div>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-base font-bold">
                    {displayMoney(p.from, currency, locale)}
                  </span>
                  <span className="muted block text-[0.65rem]">{t("landing.board.per")}</span>
                </span>
              </div>

              {/* Categories are the level people actually shop at, so they
                  are links in their own right rather than a summary line. */}
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {p.categories.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/services?platform=${p.slug}&category=${c.id}`}
                      className="surface-2 muted flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors hover:text-[var(--text)]"
                    >
                      {c.name}
                      <span className="font-mono opacity-60">{c.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>

      <section className="container-page pb-16">
        <div className="grid gap-4 border-t border-[var(--border)] pt-8 sm:grid-cols-3">
          {[
            { icon: "zap" as const, title: t("landing.trust.speed"), body: t("landing.trust.speedBody") },
            { icon: "refresh" as const, title: t("landing.trust.refill"), body: t("landing.trust.refillBody") },
            { icon: "ticket" as const, title: t("landing.trust.support"), body: t("landing.trust.supportBody") },
          ].map((f) => (
            <article key={f.title} className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-[var(--primary)]">
                <Icon name={f.icon} size={19} />
              </span>
              <div>
                <h3 className="text-sm font-semibold">{f.title}</h3>
                <p className="muted mt-1 text-sm leading-relaxed">{f.body}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="muted mt-8 text-center text-xs">{settings["site.supportEmail"] as string}</p>
      </section>
    </>
  );
}
