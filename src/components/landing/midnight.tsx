import { localeTag } from "@/lib/numbers";
import Link from "next/link";
import { Icon } from "@/components/icons";
import PlatformMark from "@/components/platform-mark";
import { ClosingCta, Faqs, PaymentStrip, Quotes, Steps, rateLabel } from "./sections";
import type { LayoutProps } from "./types";

/**
 * Midnight.
 *
 * Dark whatever the reader's colour mode says. The palette itself lives in
 * globals.css as `.landing-midnight` and is applied by the public layout, not
 * here: set on this page it would leave a light header sitting on top of a
 * black page, which is not a look but a mistake.
 */
export default function Midnight(props: LayoutProps) {
  const { data, t, currency, locale, settings, signedIn } = props;
  const count = new Intl.NumberFormat(localeTag(locale));

  const figures = [
    { value: data.completedCount, label: t("landing.night.delivered") },
    { value: data.serviceCount, label: t("admin.services") },
    { value: data.userCount, label: t("admin.users") },
    { value: data.orderCount, label: t("dash.orders") },
  ].filter((f) => f.value > 0);

  return (
    <>
      <section className="relative overflow-hidden">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-[-24rem] h-[46rem]"
          style={{
            background:
              "radial-gradient(45% 50% at 50% 60%, color-mix(in srgb, var(--primary) 55%, transparent), transparent), radial-gradient(30% 40% at 15% 70%, color-mix(in srgb, var(--accent) 45%, transparent), transparent)",
          }}
        />

        <div className="container-page relative py-16 text-center sm:py-20">
          <h1 className="mx-auto max-w-3xl text-4xl leading-[1.1] font-extrabold tracking-[-0.03em] sm:text-6xl">
            {t("landing.night.title")}{" "}
            <span
              style={{
                background: "linear-gradient(90deg, var(--primary), var(--accent))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {t("landing.night.titleAccent")}
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed" style={{ color: "var(--muted)" }}>
            {t("landing.night.sub")}
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-3">
            {signedIn ? (
              <Link href="/dashboard/new-order" className="btn btn-primary btn-lg">
                {t("dash.newOrder")}
                <Icon name="arrowRight" size={16} />
              </Link>
            ) : (
              <>
                <Link href="/register" className="btn btn-primary btn-lg">
                  {t("landing.night.cta")}
                  <Icon name="arrowRight" size={16} />
                </Link>
                <Link href="/login" className="btn btn-ghost btn-lg">
                  {t("nav.signin")}
                </Link>
              </>
            )}
          </div>

          {data.from > 0 && (
            <p className="mt-6 text-sm" style={{ color: "var(--muted)" }}>
              {t("landing.spot.from", rateLabel(data.from, currency, locale, settings, t))}
            </p>
          )}
        </div>
      </section>

      {/* The band this look is known for: four figures across a hairline rule.
          Only the ones a panel actually has — a brand new install shows two
          rather than four zeroes. */}
      {figures.length > 0 && (
        <section className="border-y" style={{ borderColor: "var(--border)" }}>
          <ul className="container-page grid grid-cols-2 gap-y-8 py-10 lg:grid-cols-4">
            {figures.map((f) => (
              <li key={f.label} className="text-center">
                <p className="font-mono text-3xl font-bold tabular-nums sm:text-4xl">{count.format(f.value)}</p>
                <p className="mt-1.5 text-xs tracking-widest uppercase" style={{ color: "var(--muted)" }}>
                  {f.label}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="container-page py-16">
        <h2 className="text-center text-2xl font-extrabold tracking-[-0.02em] sm:text-4xl">
          {t("landing.night.platforms")}
        </h2>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.platforms.map((p) => (
            <li
              key={p.id}
              className="rounded-2xl border p-5 transition-colors"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <div className="flex items-center gap-3">
                <PlatformMark platform={p} size={20} box={44} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    {t("landing.night.services", { n: count.format(p.services) })}
                  </p>
                </div>
              </div>
              {/* A price with no unit beside it is the reader's guess. */}
              <p className="mt-4 font-mono text-lg font-semibold tabular-nums">
                {rateLabel(p.from, currency, locale, settings, t).amount}
                <span className="ml-1.5 font-sans text-xs font-normal" style={{ color: "var(--muted)" }}>
                  {rateLabel(p.from, currency, locale, settings, t).unit}
                </span>
              </p>
            </li>
          ))}
        </ul>
      </section>

      <Steps t={t} />
      <Quotes quotes={data.quotes} title={t("landing.quotes.title")} />
      <Faqs questions={data.questions} title={t("landing.faq.title")} />
      <PaymentStrip payments={data.payments} title={t("landing.pay.title")} note={t("landing.pay.note")} />
      <ClosingCta t={t} settings={settings} />
    </>
  );
}
