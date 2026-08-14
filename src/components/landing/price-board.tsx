import Link from "next/link";
import { Icon } from "@/components/icons";
import PlatformMark from "@/components/platform-mark";
import Hero from "./hero";
import { ClosingCta, Faqs, PaymentStrip, PlatformStrip, QualityTags, Quotes, StatTiles, Steps, rateLabel } from "./sections";
import type { LayoutProps } from "./types";

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
export default function PriceBoard(props: LayoutProps) {
  const { data, t, currency, locale } = props;
  const cheapest = [...data.platforms].sort((a, b) => a.from - b.from);
  const count = new Intl.NumberFormat(locale === "vi" ? "vi-VN" : locale);
  const rate = (n: number) => rateLabel(n, currency, locale, props.settings, t);

  return (
    <>
      <Hero {...props} />
      <PlatformStrip platforms={data.platforms} label={t("landing.hero.platforms")} />

      <section className="container-page pt-14">
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
                    <span className="mt-1.5 flex">
                      <QualityTags platform={p} t={t} />
                    </span>
                  </span>
                  <span className="muted hidden w-24 text-right font-mono text-sm sm:block">
                    {count.format(p.services)}
                  </span>
                  <span className="w-32 text-right sm:w-44">
                    <span className="block font-mono text-[1.35rem] leading-none font-bold">
                      {rate(p.from).amount}
                    </span>
                    <span className="muted mt-1 block text-[0.68rem]">{rate(p.from).unit}</span>
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

      <StatTiles data={data} t={t} />
      <PaymentStrip payments={data.payments} title={t("landing.pay.title")} note={t("landing.pay.note")} />
      <Steps t={t} />
      <Quotes quotes={data.quotes} title={t("landing.quotes.title")} />
      <Faqs questions={data.questions} title={t("landing.faq.title")} />
      <ClosingCta t={t} settings={props.settings} />
    </>
  );
}
