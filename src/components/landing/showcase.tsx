import Link from "next/link";
import Image from "next/image";
import { Icon } from "@/components/icons";
import PlatformMark from "@/components/platform-mark";
import PlatformCluster from "./platform-cluster";
import { ClosingCta, Faqs, PaymentStrip, Quotes, Steps, rateLabel } from "./sections";
import type { LayoutProps } from "./types";
import type { IconName } from "@/components/icons";

/**
 * Showcase.
 *
 * The shape agencies in this market use: the argument on the left, a picture
 * on the right, and the platforms sitting under the picture. It is the only
 * layout here that wants a photograph, so it is the only one that asks for
 * one — `landing.heroImage` in admin. With nothing uploaded it falls back to
 * the drawn artwork rather than to a grey rectangle, so a panel installed ten
 * minutes ago still has a finished home page.
 *
 * Longer body copy than the others on purpose. This opening is for an
 * operator selling to businesses rather than to resellers, where the reader
 * wants to be told what they are buying before being asked to sign up.
 */
export default function Showcase(props: LayoutProps) {
  const { data, t, currency, locale, settings, signedIn } = props;
  const count = new Intl.NumberFormat(locale === "vi" ? "vi-VN" : locale);
  const heroImage = String(settings["landing.heroImage"] ?? "");

  // From the ratings the operator's own testimonials carry. Five outlined
  // stars beside a review count is the shape every page in this market uses
  // and says nothing — it shows the same five whether the panel is loved or
  // not. Filled to the average, or left off where nobody rated anything.
  const rated = data.quotes.filter((q) => q.rating > 0);
  const average = rated.length > 0 ? rated.reduce((n, q) => n + q.rating, 0) / rated.length : 0;
  const filled = Math.round(average);

  const points: { icon: IconName; label: string }[] = [
    { icon: "zap", label: t("landing.trust.speed") },
    { icon: "refresh", label: t("landing.trust.refill") },
    { icon: "shield", label: t("landing.show.safe") },
    { icon: "ticket", label: t("landing.trust.support") },
  ];

  return (
    <>
      <section className="relative overflow-hidden">
        {/* Warm at one corner, cool at the other: enough to lift the page off
            white without becoming a colour the brand has to live with. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            background:
              "radial-gradient(60% 60% at 8% 0%, var(--primary), transparent), radial-gradient(55% 55% at 100% 30%, var(--accent), transparent)",
          }}
        />

        <div className="container-page relative grid items-center gap-12 py-14 lg:grid-cols-2 lg:py-20">
          <div>
            {rated.length > 0 && (
              <p className="flex items-center gap-2 text-sm font-medium">
                <span className="flex gap-0.5" aria-hidden>
                  {Array.from({ length: 5 }, (_, i) => (
                    <span key={i} className={i < filled ? "text-[var(--warning)]" : "muted opacity-30"}>
                      <Icon name={i < filled ? "starFilled" : "star"} size={14} />
                    </span>
                  ))}
                </span>
                <span className="font-mono tabular-nums">{average.toFixed(1)}</span>
                {t("landing.show.rated", { n: count.format(rated.length) })}
              </p>
            )}

            <h1 className="mt-4 text-4xl leading-[1.1] font-extrabold tracking-[-0.03em] sm:text-5xl">
              {t("landing.show.title")}{" "}
              <span className="text-[var(--primary)]">{t("landing.show.titleAccent")}</span>
            </h1>

            <div className="muted mt-6 space-y-4 text-base leading-relaxed">
              <p>{t("landing.show.body1")}</p>
              <p>{t("landing.show.body2")}</p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {signedIn ? (
                <Link href="/dashboard/new-order" className="btn btn-primary btn-lg">
                  {t("dash.newOrder")}
                  <Icon name="arrowRight" size={16} />
                </Link>
              ) : (
                <>
                  <Link href="/register" className="btn btn-primary btn-lg">
                    {t("landing.show.cta")}
                    <Icon name="arrowRight" size={16} />
                  </Link>
                  <Link href="/login" className="btn btn-ghost btn-lg">
                    {t("nav.signin")}
                  </Link>
                </>
              )}
            </div>

            {data.from > 0 && (
              <p className="muted mt-5 text-sm">
                {t("landing.spot.from", rateLabel(data.from, currency, locale, settings, t))}
              </p>
            )}
          </div>

          <div>
            {heroImage ? (
              <>
                <Image
                  src={heroImage}
                  alt=""
                  width={720}
                  height={720}
                  className="mx-auto w-full max-w-[28rem] rounded-3xl object-cover"
                  priority
                />
                {/* Under the photograph, where this shape always puts them —
                    and only there. Beneath the cluster they would be the same
                    logos twice. */}
                <ul className="mt-6 flex flex-wrap justify-center gap-2.5">
                  {data.platforms.slice(0, 7).map((p) => (
                    <li key={p.id}>
                      <PlatformMark platform={p} size={22} box={44} />
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <PlatformCluster platforms={data.platforms} />
            )}
          </div>
        </div>
      </section>

      <section className="container-page pb-14">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {points.map((p) => (
            <li key={p.label} className="card card-pad flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] text-[var(--primary)]">
                <Icon name={p.icon} size={18} />
              </span>
              <span className="font-semibold">{p.label}</span>
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
