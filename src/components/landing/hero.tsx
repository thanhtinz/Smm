import Link from "next/link";
import { Icon } from "@/components/icons";
import PlatformMark from "@/components/platform-mark";
import { displayMoney } from "@/lib/currency";
import HeroLogin from "./hero-login";
import { Pills } from "./sections";
import type { LandingProps, LayoutProps } from "./types";

/**
 * The hero.
 *
 * Left: what the panel is and the cheapest rate on it. Right: the sign-in
 * box, because most people who land here already have an account.
 *
 * Behind it: whatever artwork the operator uploaded. Panels in this market
 * lean on a mascot or a product shot, and that is theirs to supply — with no
 * image the space goes to a stack of cards built from the orders the panel
 * actually finished, which is worth more than stock artwork anyway.
 */
export default function Hero({
  data,
  t,
  currency,
  locale,
  settings,
  captcha,
  loginLabels,
  signedIn,
}: LayoutProps) {
  const heroImage = String(settings["landing.heroImage"] ?? "");
  const showLogin = settings["landing.heroLogin"] !== false && !signedIn;
  const count = new Intl.NumberFormat(locale === "vi" ? "vi-VN" : locale);

  return (
    <section className="relative overflow-hidden">
      {/* Two washes in the theme's own colours. They are the only thing on
          the page that is purely decorative, and they cost nothing to skip
          on a narrow screen. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 420px at 12% 0%, color-mix(in srgb, var(--primary) 22%, transparent), transparent 70%)," +
            "radial-gradient(760px 380px at 88% 10%, color-mix(in srgb, var(--accent) 20%, transparent), transparent 70%)",
        }}
      />

      <div className="container-page grid gap-10 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-20">
        <div>
          {data.completedCount > 0 && (
            <p className="surface-2 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium">
              <span className="text-[var(--success)]">
                <Icon name="checkCircle" size={15} />
              </span>
              {t("landing.hero.badge", { n: count.format(data.completedCount) })}
            </p>
          )}

          <h1 className="mt-5 text-[2.6rem] leading-[1.03] font-extrabold tracking-[-0.035em] sm:text-[4rem]">
            {t("landing.headline")}
          </h1>
          <p className="muted mt-6 max-w-xl text-lg leading-relaxed">{t("landing.sub")}</p>

          {data.from > 0 && (
            <p className="mt-7 flex flex-wrap items-baseline gap-3">
              <span className="muted text-sm font-semibold tracking-[0.16em] uppercase">
                {t("landing.board.from")}
              </span>
              <span className="font-mono text-4xl leading-none font-bold text-[var(--primary)] sm:text-5xl">
                {displayMoney(data.from, currency, locale)}
              </span>
              <span className="muted text-sm">{t("landing.board.per")}</span>
            </p>
          )}

          <div className="mt-8">
            <Pills t={t} />
          </div>
        </div>

        <div className="lg:pl-4">
          {showLogin ? (
            <div className="popover p-6 shadow-2xl sm:p-7">
              <HeroLogin captcha={captcha} labels={loginLabels} />
            </div>
          ) : heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroImage} alt="" className="mx-auto w-full max-w-md object-contain" />
          ) : (
            <DeliveryCards data={data} t={t} locale={locale} />
          )}
        </div>
      </div>

      {/* The artwork keeps its place under the sign-in box rather than being
          dropped: an operator who uploaded one should see it either way. */}
      {showLogin && heroImage && (
        <div className="container-page -mt-4 hidden pb-10 lg:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={heroImage} alt="" className="mx-auto max-h-64 object-contain" />
        </div>
      )}
    </section>
  );
}

/** Finished orders, stacked. Real rows or nothing — never a mock-up. */
function DeliveryCards({
  data,
  t,
  locale,
}: Pick<LandingProps, "data" | "t"> & { locale: string }) {
  const count = new Intl.NumberFormat(locale === "vi" ? "vi-VN" : locale);
  const rows = data.recent.slice(0, 4);
  if (!rows.length) return null;

  return (
    <div className="space-y-3">
      <p className="muted text-xs font-semibold tracking-[0.16em] uppercase">{t("landing.proof.feed")}</p>
      {rows.map((o, i) => (
        <div
          key={o.id}
          className="popover flex items-center gap-3 px-4 py-3.5 shadow-xl"
          // Fanned slightly, so the stack reads as a stack rather than a list.
          style={{ marginLeft: `${i * 14}px` }}
        >
          {o.platform ? (
            <PlatformMark platform={o.platform} box={34} />
          ) : (
            <span className="muted flex h-[34px] w-[34px] items-center justify-center">
              <Icon name="package" size={17} />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{o.service}</span>
            <span className="muted block font-mono text-xs">+{count.format(o.quantity)}</span>
          </span>
          <span className="text-[var(--success)]">
            <Icon name="checkCircle" size={17} />
          </span>
        </div>
      ))}
    </div>
  );
}
