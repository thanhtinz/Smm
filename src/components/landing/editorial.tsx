import Link from "next/link";
import { Icon } from "@/components/icons";
import { displayMoney } from "@/lib/currency";
import { Faqs, Quotes } from "./sections";
import type { LayoutProps } from "./types";

/**
 * Editorial.
 *
 * No cards, no tiles, no icon grid — rules and space instead, set in the
 * display serif. The signature is the platform index: the catalogue read as
 * a contents page, with the starting price hanging in the outer margin the
 * way a page number would.
 */
export default function Editorial({ data, t, currency, locale, settings }: LayoutProps) {
  const steps = [
    { title: t("landing.howto.1.title"), body: t("landing.howto.1.body") },
    { title: t("landing.howto.2.title"), body: t("landing.howto.2.body") },
    { title: t("landing.howto.3.title"), body: t("landing.howto.3.body") },
  ];

  return (
    <>
      <section className="container-page pt-20 pb-16 sm:pt-28">
        <div className="max-w-3xl">
          <p className="muted text-xs font-semibold tracking-[0.22em] uppercase">
            {(settings["site.tagline"] as string) || t("landing.badge")}
          </p>
          <h1 className="font-display mt-7 text-[2.75rem] leading-[1.04] font-medium tracking-[-0.015em] sm:text-[4.25rem]">
            {t("landing.headline")}
          </h1>
          <p className="muted mt-8 max-w-xl text-lg leading-[1.75]">{t("landing.sub")}</p>
          <p className="mt-9">
            <Link href="/register" className="btn btn-primary btn-lg">
              {t("landing.cta.primary")}
              <Icon name="arrowRight" size={17} />
            </Link>
          </p>
        </div>
      </section>

      {/* The index. Rules run the full measure, prices hang at the right —
          the catalogue read as a contents page rather than a shop shelf. */}
      <section className="container-page pb-20">
        <h2 className="muted border-b border-[var(--text)] pb-2.5 text-xs font-semibold tracking-[0.22em] uppercase">
          {t("landing.platforms.title")}
        </h2>
        <ul>
          {data.platforms.map((p) => (
            <li key={p.id} className="border-b border-[var(--border)]">
              <Link
                href={`/services?platform=${p.slug}`}
                className="group flex items-baseline gap-6 py-6 transition-opacity hover:opacity-60"
              >
                <span className="font-display text-2xl sm:text-[1.75rem]">{p.name}</span>
                <span className="muted hidden min-w-0 flex-1 truncate text-sm sm:block">
                  {p.categories
                    .slice(0, 4)
                    .map((c) => c.name)
                    .join(", ")}
                </span>
                <span className="ml-auto shrink-0 text-right sm:ml-0">
                  <span className="block font-mono text-lg">{displayMoney(p.from, currency, locale)}</span>
                  <span className="muted mt-0.5 block text-[0.68rem]">{t("landing.board.per")}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="container-page pb-20">
        <div className="grid gap-12 md:grid-cols-3">
          {steps.map((s, i) => (
            <article key={s.title}>
              <p className="muted font-mono text-xs tracking-[0.2em]">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="font-display mt-4 text-2xl">{s.title}</h3>
              <p className="muted mt-3 leading-[1.75]">{s.body}</p>
            </article>
          ))}
        </div>
      </section>

      <Quotes quotes={data.quotes} title={t("landing.quotes.title")} />
      <Faqs questions={data.questions} title={t("landing.faq.title")} />

      <section className="container-page pb-28">
        <div className="border-t border-[var(--text)] pt-10">
          <h2 className="font-display text-4xl">{t("landing.cta.final.title")}</h2>
          <p className="muted mt-3 max-w-lg text-lg leading-[1.75]">{t("landing.cta.final.body")}</p>
          <p className="mt-8">
            <Link href="/register" className="btn btn-primary btn-lg">
              {t("landing.cta.primary")}
              <Icon name="arrowRight" size={17} />
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
