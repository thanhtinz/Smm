import Link from "next/link";
import { Icon } from "@/components/icons";
import { displayMoney } from "@/lib/currency";
import QuotePicker from "./quote-picker";
import type { LandingProps } from "./types";

/**
 * Order first.
 *
 * The whole page is arranged around one working control: the same
 * platform → category → service cascade the order form uses, above the fold,
 * quoting a real price from real rates. Everything else on the page is
 * subordinate to it and set quietly.
 */
export default function OrderFirst({ data, t, currency, locale, settings }: LandingProps) {
  const m = {
    rate: currency.rate,
    symbol: currency.symbol,
    symbolBefore: currency.symbolBefore,
    decimals: currency.decimals,
    locale,
  };

  const assurances = [
    { icon: "zap" as const, text: t("landing.trust.speed") },
    { icon: "refresh" as const, text: t("landing.trust.refill") },
    { icon: "creditCard" as const, text: t("landing.trust.pay") },
    { icon: "code" as const, text: t("landing.trust.api") },
  ];

  return (
    <>
      <section className="container-page grid gap-8 py-10 lg:grid-cols-[1.35fr_0.65fr] lg:py-14">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("landing.quote.title")}</h1>
          <p className="muted mt-2 text-sm">{t("landing.quote.sub")}</p>
          <div className="mt-5">
            <QuotePicker
              platforms={data.platforms}
              picks={data.picks}
              m={m}
              labels={{
                category: t("order.category"),
                service: t("order.service"),
                quantity: t("order.quantity"),
                charge: t("order.charge"),
                start: t("landing.cta.primary"),
                browse: t("landing.cta.secondary"),
              }}
            />
          </div>
        </div>

        <aside className="space-y-6 lg:pt-14">
          <ul className="space-y-3">
            {assurances.map((a) => (
              <li key={a.text} className="flex items-center gap-3 text-sm">
                <span className="text-[var(--primary)]">
                  <Icon name={a.icon} size={17} />
                </span>
                {a.text}
              </li>
            ))}
          </ul>

          {/* Counts straight from the tables — nothing padded, so a young
              panel shows small numbers rather than invented ones. */}
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--border)]">
            {[
              { k: t("landing.stat.services"), v: data.serviceCount },
              { k: t("landing.stat.users"), v: data.userCount },
              { k: t("landing.stat.orders"), v: data.completedCount },
              { k: t("landing.board.from"), v: null },
            ].map((s) => (
              <div key={s.k} className="bg-[var(--surface)] px-4 py-4">
                <dd className="text-xl font-bold tabular-nums">
                  {s.v === null ? displayMoney(data.from, currency, locale) : s.v.toLocaleString()}
                </dd>
                <dt className="muted mt-0.5 text-xs">{s.k}</dt>
              </div>
            ))}
          </dl>

          <p className="muted text-xs leading-relaxed">{settings["site.description"] as string}</p>
        </aside>
      </section>

      <section className="container-page pb-16">
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border)] pt-6">
          <p className="text-sm font-medium">{t("landing.cta.final.title")}</p>
          <Link href="/register" className="btn btn-primary">
            {t("landing.cta.primary")}
            <Icon name="arrowRight" size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}
