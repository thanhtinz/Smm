import { localeTag } from "@/lib/numbers";
import { Icon } from "@/components/icons";
import Artwork from "./artwork";
import HeroLogin from "./hero-login";
import { Pills, rateLabel } from "./sections";
import type { LayoutProps } from "./types";

/**
 * The hero.
 *
 * Laid out the way this market lays it out: everything a visitor acts on down
 * the left — what the panel is, the cheapest rate, the sign-in box — and the
 * picture holding the right. Both halves are always filled, which is the
 * point: a home page with an empty right column looks unfinished no matter
 * how good the left one is.
 *
 * The picture is the operator's uploaded artwork if they have any, and a
 * drawing built from their own catalogue if they do not.
 */
export default function Hero({ data, t, currency, locale, settings, captcha, loginLabels, signedIn }: LayoutProps) {
  const heroImage = String(settings["landing.heroImage"] ?? "");
  const showLogin = settings["landing.heroLogin"] !== false && !signedIn;
  const count = new Intl.NumberFormat(localeTag(locale));
  const cheapest = rateLabel(data.from, currency, locale, settings, t);

  return (
    <section className="relative overflow-hidden">
      {/* Two washes in the theme's own colours. The only purely decorative
          thing on the page, and free to skip on a narrow screen. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 460px at 10% -5%, color-mix(in srgb, var(--primary) 26%, transparent), transparent 70%)," +
            "radial-gradient(800px 420px at 92% 8%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 70%)",
        }}
      />

      <div className="container-page grid items-center gap-12 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
        <div>
          {data.completedCount > 0 && (
            <p className="surface-2 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium">
              <span className="text-[var(--success)]">
                <Icon name="checkCircle" size={15} />
              </span>
              {t("landing.hero.badge", { n: count.format(data.completedCount) })}
            </p>
          )}

          <h1 className="mt-5 text-[2.4rem] leading-[1.04] font-extrabold tracking-[-0.035em] sm:text-[3.4rem]">
            {t("landing.headline")}
          </h1>
          <p className="muted mt-5 max-w-xl leading-relaxed">{t("landing.sub")}</p>

          {data.from > 0 && (
            <p className="mt-6 flex flex-wrap items-baseline gap-3">
              <span className="muted text-sm font-semibold tracking-[0.16em] uppercase">
                {t("landing.board.from")}
              </span>
              <span className="font-mono text-4xl leading-none font-bold text-[var(--primary)]">
                {cheapest.amount}
              </span>
              <span className="muted text-sm">{cheapest.unit}</span>
            </p>
          )}

          {showLogin && (
            <div className="popover mt-7 max-w-md p-6 shadow-2xl">
              <HeroLogin captcha={captcha} labels={loginLabels} />
            </div>
          )}

          <div className="mt-7">
            <Pills t={t} />
          </div>
        </div>

        <div>
          {heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroImage} alt="" className="mx-auto w-full max-w-md object-contain" />
          ) : (
            <Artwork platforms={data.platforms} />
          )}
        </div>
      </div>
    </section>
  );
}
