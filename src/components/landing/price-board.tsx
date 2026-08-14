import Link from "next/link";
import { Icon } from "@/components/icons";
import PlatformMark from "@/components/platform-mark";
import { displayMoney } from "@/lib/currency";
import type { LandingProps } from "./types";

/**
 * The price board.
 *
 * Every other layout here opens with a sentence. This one opens with the
 * prices, because in this market that is the question the visitor arrived
 * with — a landing page that makes them scroll past a headline to find out
 * what a thousand followers costs is answering a question nobody asked.
 *
 * Set like a market board: ranked, ruled, figures in a monospace column so
 * the digits line up down the page and the cheapest row is obvious without
 * reading a word. Each row carries its platform's own colour, which is the
 * only decoration on the page and the thing that makes it scannable.
 */
export default function PriceBoard({ data, t, currency, locale, settings }: LandingProps) {
  const cheapest = [...data.platforms].sort((a, b) => a.from - b.from);
  const count = new Intl.NumberFormat(locale === "vi" ? "vi-VN" : locale);

  return (
    <>
      <section className="container-page pt-14 pb-10 sm:pt-20">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-2xl">
            <h1 className="text-[2.4rem] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-6xl">
              {t("landing.board.title")}
            </h1>
            <p className="muted mt-5 text-lg leading-relaxed">{t("landing.board.sub")}</p>
          </div>

          {/* The cheapest rate anywhere on the panel, stated once and large.
              It is the number the visitor is scanning for anyway. */}
          <div className="shrink-0">
            <p className="muted text-xs font-semibold tracking-[0.18em] uppercase">{t("landing.board.from")}</p>
            <p className="mt-2 font-mono text-5xl leading-none font-bold text-[var(--primary)] sm:text-6xl">
              {displayMoney(data.from, currency, locale)}
            </p>
            <p className="muted mt-2 text-sm">{t("landing.board.per")}</p>
          </div>
        </div>
      </section>

      <section className="container-page">
        {/* A board, not a table element: each row is a link into the
            catalogue already filtered to that platform. */}
        <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
          <div className="muted flex items-center gap-4 border-b border-[var(--border)] bg-[var(--surface2)] px-5 py-3 text-[0.68rem] font-semibold tracking-[0.16em] uppercase">
            <span className="w-6" />
            <span className="flex-1">{t("order.platform")}</span>
            <span className="hidden w-24 text-right sm:block">{t("landing.board.services")}</span>
            <span className="w-32 text-right sm:w-44">{t("landing.board.from")}</span>
          </div>

          <ul>
            {cheapest.map((p, i) => (
              <li key={p.id} className="border-b border-[var(--border)] last:border-0">
                <Link
                  href={`/services?platform=${p.slug}`}
                  className="group relative flex items-center gap-4 bg-[var(--surface)] px-5 py-5 transition-colors"
                  style={{ ["--row" as string]: p.color }}
                >
                  {/* The platform's colour, as a rail that fills on hover
                      rather than a tint that is always on. */}
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-[3px] scale-y-0 transition-transform duration-200 group-hover:scale-y-100"
                    style={{ background: p.color }}
                  />
                  <span className="muted w-6 shrink-0 font-mono text-sm">{i + 1}</span>
                  <PlatformMark platform={p} box={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[1.05rem] font-semibold">{p.name}</span>
                    <span className="muted block truncate text-xs">
                      {p.categories
                        .slice(0, 3)
                        .map((c) => c.name)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="muted hidden w-24 text-right font-mono text-sm sm:block">
                    {count.format(p.services)}
                  </span>
                  <span className="w-32 text-right sm:w-44">
                    <span className="block font-mono text-[1.35rem] leading-none font-bold">
                      {displayMoney(p.from, currency, locale)}
                    </span>
                    <span className="muted mt-1 block text-[0.68rem]">{t("landing.board.per")}</span>
                  </span>
                  <span className="muted hidden transition-transform group-hover:translate-x-1 sm:block">
                    <Icon name="chevronRight" size={17} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <p className="muted mt-4 text-sm">{t("landing.board.note")}</p>
      </section>

      <section className="container-page py-16">
        <div className="grid gap-8 sm:grid-cols-3">
          {[
            { icon: "zap" as const, title: t("landing.trust.speed"), body: t("landing.trust.speedBody") },
            { icon: "refresh" as const, title: t("landing.trust.refill"), body: t("landing.trust.refillBody") },
            { icon: "creditCard" as const, title: t("landing.trust.pay"), body: t("landing.trust.payBody") },
          ].map((f) => (
            <article key={f.title}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] text-[var(--primary)]">
                <Icon name={f.icon} size={21} />
              </span>
              <h2 className="mt-4 text-lg font-bold tracking-tight">{f.title}</h2>
              <p className="muted mt-2 leading-relaxed">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container-page pb-20">
        <div className="flex flex-wrap items-center justify-between gap-5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-8 py-9">
          <div>
            <h2 className="text-2xl font-extrabold tracking-[-0.02em]">{t("landing.cta.final.title")}</h2>
            <p className="muted mt-1.5">{settings["site.supportEmail"] as string}</p>
          </div>
          <Link href="/register" className="btn btn-primary btn-lg">
            {t("landing.cta.primary")}
            <Icon name="arrowRight" size={17} />
          </Link>
        </div>
      </section>
    </>
  );
}
