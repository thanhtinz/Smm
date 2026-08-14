import { Icon } from "@/components/icons";
import PlatformMark from "@/components/platform-mark";
import Hero from "./hero";
import { ClosingCta, Faqs, PlatformStrip, Quotes, StatTiles } from "./sections";
import type { LayoutProps } from "./types";

/**
 * Proof.
 *
 * The one thing a buyer in this market is actually weighing is whether the
 * panel delivers, so the page is built out of finished orders: what was
 * delivered, how much of it, and how long it took. The rows are real and
 * anonymised — no name, no link, nothing that identifies a customer.
 *
 * There is no invented number anywhere on this layout. A panel on its first
 * week shows a short list, which is the honest thing for it to show.
 */
export default function Proof(props: LayoutProps) {
  const { data, t, locale } = props;
  const count = new Intl.NumberFormat(locale === "vi" ? "vi-VN" : locale);

  const elapsed = (seconds: number) => {
    if (seconds < 90) return t("time.seconds", { n: seconds });
    const minutes = Math.round(seconds / 60);
    if (minutes < 90) return t("time.minutes", { n: minutes });
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? t("time.hoursMinutes", { h: hours, m: rest }) : t("time.hours", { n: hours });
  };

  const guarantees = [
    { icon: "shield" as const, title: t("landing.trust.refill"), body: t("landing.trust.refillBody") },
    { icon: "zap" as const, title: t("landing.trust.speed"), body: t("landing.trust.speedBody") },
    { icon: "creditCard" as const, title: t("landing.trust.pay"), body: t("landing.trust.payBody") },
    { icon: "ticket" as const, title: t("landing.trust.support"), body: t("landing.trust.supportBody") },
  ];

  return (
    <>
      <Hero {...props} />
      <PlatformStrip platforms={data.platforms} label={t("landing.hero.platforms")} />
      <StatTiles data={data} t={t} />

      <section className="container-page pt-4 pb-6">
        <h2 className="text-2xl font-extrabold tracking-[-0.02em] sm:text-4xl">{t("landing.proof.title")}</h2>
        <p className="muted mt-3 max-w-xl text-lg leading-relaxed">{t("landing.proof.sub")}</p>

        <div className="card mt-8 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-3">
            <span className="text-[var(--success)]">
              <Icon name="checkCircle" size={15} />
            </span>
            <h3 className="text-sm font-semibold">{t("landing.proof.feed")}</h3>
          </div>

          {data.recent.length === 0 ? (
            <p className="muted px-5 py-10 text-center text-sm">{t("common.none")}</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {data.recent.map((o) => (
                <li key={o.id} className="flex items-center gap-3.5 px-5 py-3.5">
                  {o.platform ? (
                    <PlatformMark platform={o.platform} box={34} />
                  ) : (
                    <span className="muted flex h-[34px] w-[34px] shrink-0 items-center justify-center">
                      <Icon name="package" size={17} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{o.service}</span>
                    <span className="muted block font-mono text-xs">+{count.format(o.quantity)}</span>
                  </span>
                  <span className="muted shrink-0 font-mono text-xs">
                    {o.seconds === null ? "" : elapsed(o.seconds)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="muted mt-3 text-xs">{t("landing.proof.note")}</p>
      </section>

      <section className="container-page py-12">
        <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
          {guarantees.map((g) => (
            <article key={g.title} className="border-t border-[var(--border)] pt-4">
              <h3 className="flex items-center gap-2 font-semibold">
                <span className="text-[var(--primary)]">
                  <Icon name={g.icon} size={17} />
                </span>
                {g.title}
              </h3>
              <p className="muted mt-1.5 text-sm leading-relaxed">{g.body}</p>
            </article>
          ))}
        </div>
      </section>

      <Quotes quotes={data.quotes} title={t("landing.quotes.title")} />
      <Faqs questions={data.questions} title={t("landing.faq.title")} />
      <ClosingCta t={t} settings={props.settings} />
    </>
  );
}
