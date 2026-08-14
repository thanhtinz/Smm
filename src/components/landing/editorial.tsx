import Link from "next/link";
import { Icon } from "@/components/icons";
import { displayMoney } from "@/lib/currency";
import type { LandingProps } from "./types";

/** Serif, from whatever the machine already has. The panel loads no webfont,
 *  so promising one would just mean a silent fallback. */
const SERIF = 'Georgia, "Times New Roman", "Noto Serif", serif';

/**
 * Editorial.
 *
 * No cards, no tiles, no icon grid — rules and space instead. The signature
 * is the platform index: the catalogue set as a contents page, with the
 * starting price sitting in the outer margin the way a page number would.
 */
export default function Editorial({ data, t, currency, locale, settings }: LandingProps) {
  const steps = [
    { title: t("landing.howto.1.title"), body: t("landing.howto.1.body") },
    { title: t("landing.howto.2.title"), body: t("landing.howto.2.body") },
    { title: t("landing.howto.3.title"), body: t("landing.howto.3.body") },
  ];

  return (
    <>
      <section className="container-page pt-20 pb-14 sm:pt-28">
        <div className="max-w-3xl">
          <p className="muted text-xs font-semibold tracking-[0.2em] uppercase">
            {(settings["site.tagline"] as string) || t("landing.badge")}
          </p>
          <h1
            className="mt-6 text-[2.6rem] leading-[1.06] font-normal tracking-[-0.01em] sm:text-6xl"
            style={{ fontFamily: SERIF }}
          >
            {t("landing.headline")}
          </h1>
          <p className="muted mt-7 max-w-xl text-lg leading-relaxed">{t("landing.sub")}</p>
          <p className="mt-8">
            <Link href="/register" className="btn btn-primary btn-lg">
              {t("landing.cta.primary")}
              <Icon name="arrowRight" size={17} />
            </Link>
          </p>
        </div>
      </section>

      {/* The index. Rules run the full measure, prices hang at the right —
          the catalogue read as a contents page rather than a shop shelf. */}
      <section className="container-page pb-16">
        <h2 className="muted border-b border-[var(--text)] pb-2 text-xs font-semibold tracking-[0.2em] uppercase">
          {t("landing.platforms.title")}
        </h2>
        <ul>
          {data.platforms.map((p) => (
            <li key={p.id} className="border-b border-[var(--border)]">
              <Link
                href={`/services?platform=${p.slug}`}
                className="flex items-baseline gap-5 py-5 transition-opacity hover:opacity-70"
              >
                <span className="text-xl sm:text-2xl" style={{ fontFamily: SERIF }}>
                  {p.name}
                </span>
                <span className="muted hidden min-w-0 flex-1 truncate text-sm sm:block">
                  {p.categories
                    .slice(0, 4)
                    .map((c) => c.name)
                    .join(", ")}
                </span>
                <span className="ml-auto shrink-0 text-right sm:ml-0">
                  <span className="block tabular-nums" style={{ fontFamily: SERIF }}>
                    {displayMoney(p.from, currency, locale)}
                  </span>
                  <span className="muted block text-[0.68rem]">{t("landing.board.per")}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="container-page pb-16">
        <div className="grid gap-10 md:grid-cols-3">
          {steps.map((s, i) => (
            <article key={s.title}>
              <p className="muted text-xs tracking-[0.2em]">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-3 text-xl" style={{ fontFamily: SERIF }}>
                {s.title}
              </h3>
              <p className="muted mt-2 text-sm leading-relaxed">{s.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container-page pb-24">
        <div className="border-t border-[var(--text)] pt-8">
          <h2 className="text-3xl" style={{ fontFamily: SERIF }}>
            {t("landing.cta.final.title")}
          </h2>
          <p className="muted mt-2 max-w-lg leading-relaxed">{t("landing.cta.final.body")}</p>
          <p className="mt-6">
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
