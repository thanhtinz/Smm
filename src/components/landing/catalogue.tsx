import Link from "next/link";
import { Icon } from "@/components/icons";
import PlatformMark from "@/components/platform-mark";
import { displayMoney } from "@/lib/currency";
import Hero from "./hero";
import { ClosingCta, Faqs, PlatformStrip, Quotes, StatTiles } from "./sections";
import type { LayoutProps } from "./types";

/**
 * Catalogue.
 *
 * A directory, not a pitch: every platform and every category it sells, on
 * one screen, each one a link straight into the filtered service list. The
 * visitor who already knows what they want never has to scroll past a
 * headline to find it, and the one who does not can see the whole shop at
 * once.
 */
export default function Catalogue(props: LayoutProps) {
  const { data, t, currency, locale } = props;
  return (
    <>
      <Hero {...props} />
      <PlatformStrip platforms={data.platforms} label={t("landing.hero.platforms")} />

      <section className="container-page pt-14 pb-4">
        <h2 className="text-2xl font-extrabold tracking-[-0.02em] sm:text-4xl">{t("landing.catalogue.title")}</h2>
        <p className="muted mt-3">
          {t("landing.catalogue.sub", { services: data.serviceCount, platforms: data.platforms.length })}
        </p>
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

      <StatTiles data={data} t={t} />
      <Quotes quotes={data.quotes} title={t("landing.quotes.title")} />
      <Faqs questions={data.questions} title={t("landing.faq.title")} />
      <ClosingCta t={t} settings={props.settings} />
    </>
  );
}
