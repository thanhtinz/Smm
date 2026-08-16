import Link from "next/link";
import { Icon } from "@/components/icons";
import { displayMoney } from "@/lib/currency";
import QuotePicker from "./quote-picker";
import { ClosingCta, Faqs, PaymentStrip, Pills, PlatformStrip, Quotes, StatTiles, Steps } from "./sections";
import type { LayoutProps } from "./types";

/**
 * Order first.
 *
 * The other layouts open with a headline and put the working controls further
 * down. This one gives the top of the page to the same
 * platform → category → service cascade the order form uses, quoting a real
 * price from real rates — so the visitor's first interaction is with the
 * product rather than with copy about it.
 */
export default function OrderFirst(props: LayoutProps) {
  const { data, t, currency, locale, settings } = props;
  const m = {
    rate: currency.rate,
    symbol: currency.symbol,
    symbolBefore: currency.symbolBefore,
    decimals: currency.decimals,
    numberFormat: currency.numberFormat,
    locale,
  };

  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(900px 400px at 20% 0%, color-mix(in srgb, var(--primary) 20%, transparent), transparent 70%)," +
              "radial-gradient(700px 340px at 85% 5%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 70%)",
          }}
        />

        <div className="container-page grid gap-9 py-12 lg:grid-cols-[1.3fr_0.7fr] lg:py-16">
          <div>
            <h1 className="text-[2.2rem] leading-[1.05] font-extrabold tracking-[-0.035em] sm:text-[3rem]">
              {t("landing.quote.title")}
            </h1>
            <p className="muted mt-3 max-w-xl text-lg">{t("landing.quote.sub")}</p>

            <div className="mt-7">
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

          <aside className="space-y-7 lg:pt-16">
            <Pills t={t} />

            {data.from > 0 && (
              <div>
                <p className="muted text-xs font-semibold tracking-[0.16em] uppercase">{t("landing.board.from")}</p>
                <p className="mt-2 font-mono text-4xl leading-none font-bold text-[var(--primary)]">
                  {displayMoney(data.from, currency, locale)}
                </p>
                <p className="muted mt-2 text-sm">{t("landing.board.per")}</p>
              </div>
            )}

            <p className="muted text-sm leading-relaxed">{settings["site.description"] as string}</p>

            <Link href="/register" className="btn btn-primary btn-lg w-full">
              {t("landing.cta.primary")}
              <Icon name="arrowRight" size={17} />
            </Link>
          </aside>
        </div>
      </section>

      <PlatformStrip platforms={data.platforms} label={t("landing.hero.platforms")} />
      <StatTiles data={data} t={t} />
      <Steps t={t} />
      <PaymentStrip payments={data.payments} title={t("landing.pay.title")} note={t("landing.pay.note")} />
      <Quotes quotes={data.quotes} title={t("landing.quotes.title")} />
      <Faqs questions={data.questions} title={t("landing.faq.title")} />
      <ClosingCta t={t} settings={settings} />
    </>
  );
}
