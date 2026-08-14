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
 * Set like a market board rather than a card grid: tabular figures, one rule
 * per row, nothing between the eye and the number.
 */
export default function PriceBoard({ data, t, currency, locale, settings }: LandingProps) {
  const cheapest = [...data.platforms].sort((a, b) => a.from - b.from);
  const count = new Intl.NumberFormat(locale === "vi" ? "vi-VN" : locale);

  return (
    <>
      <section className="container-page pt-12 pb-8 sm:pt-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("landing.board.title")}</h1>
            <p className="muted mt-3 leading-relaxed">{t("landing.board.sub")}</p>
          </div>
          <Link href="/register" className="btn btn-primary btn-lg">
            {t("landing.cta.primary")}
            <Icon name="arrowRight" size={17} />
          </Link>
        </div>
      </section>

      <section className="container-page">
        {/* A board, not a table element: each row is a link into the
            catalogue already filtered to that platform. */}
        <div className="card overflow-hidden">
          <div className="muted flex items-center gap-4 border-b border-[var(--border)] px-5 py-3 text-[0.68rem] font-semibold tracking-widest uppercase">
            <span className="flex-1">{t("order.platform")}</span>
            <span className="hidden w-28 text-right sm:block">{t("landing.board.services")}</span>
            <span className="w-32 text-right sm:w-40">{t("landing.board.from")}</span>
          </div>

          <ul>
            {cheapest.map((p) => (
              <li key={p.id} className="border-b border-[var(--border)] last:border-0">
                <Link
                  href={`/services?platform=${p.slug}`}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--surface2)]"
                >
                  <PlatformMark platform={p} box={38} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.name}</span>
                    <span className="muted block truncate text-xs">
                      {p.categories
                        .slice(0, 3)
                        .map((c) => c.name)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="muted hidden w-28 text-right text-sm tabular-nums sm:block">{count.format(p.services)}</span>
                  <span className="w-32 text-right sm:w-40">
                    <span
                      className="block text-lg font-bold tabular-nums"
                      style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}
                    >
                      {displayMoney(p.from, currency, locale)}
                    </span>
                    <span className="muted block text-[0.68rem]">{t("landing.board.per")}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <p className="muted mt-3 text-center text-xs">{t("landing.board.note")}</p>
      </section>

      <section className="container-page py-14">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: "zap" as const, title: t("landing.trust.speed"), body: t("landing.trust.speedBody") },
            { icon: "refresh" as const, title: t("landing.trust.refill"), body: t("landing.trust.refillBody") },
            { icon: "creditCard" as const, title: t("landing.trust.pay"), body: t("landing.trust.payBody") },
          ].map((f) => (
            <article key={f.title} className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-[var(--primary)]">
                <Icon name={f.icon} size={20} />
              </span>
              <div>
                <h2 className="font-semibold">{f.title}</h2>
                <p className="muted mt-1 text-sm leading-relaxed">{f.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="container-page pb-16">
        <div className="card card-pad flex flex-wrap items-center justify-between gap-4 px-7 py-8">
          <div>
            <h2 className="text-xl font-bold tracking-tight">{t("landing.cta.final.title")}</h2>
            <p className="muted mt-1 text-sm">{settings["site.supportEmail"] as string}</p>
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
