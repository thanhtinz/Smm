import { localeTag } from "@/lib/numbers";
import Link from "next/link";
import { Icon } from "@/components/icons";
import PlatformMark from "@/components/platform-mark";
import { ClosingCta, Faqs, PaymentStrip, Pills, PlatformStrip, Quotes, Steps, rateLabel } from "./sections";
import type { LayoutProps } from "./types";
import type { RecentDelivery } from "@/lib/landing";

/**
 * One side's worth of floating cards.
 *
 * Hidden below xl, where they sit under the headline instead — a card beside
 * a headline on a narrow screen is a card on top of it.
 */
function FloatColumn({
  cards,
  side,
  Card,
}: {
  cards: RecentDelivery[];
  side: "left" | "right";
  Card: (props: { order: RecentDelivery }) => React.ReactElement;
}) {
  // Dealt alternately rather than split down the middle: with three cards a
  // straight split puts two on the left and one on the right, and the page
  // leans.
  const mine = cards.filter((_, i) => (side === "left" ? i % 2 === 0 : i % 2 === 1));
  const shown = mine.filter(Boolean);
  if (shown.length === 0) return <div aria-hidden className="hidden xl:block" />;

  return (
    <div
      aria-hidden
      className={`hidden gap-6 pt-10 xl:flex xl:flex-col ${side === "left" ? "xl:items-start" : "xl:items-end"}`}
    >
      {shown.map((order, i) => (
        <div
          key={order.id}
          className={i % 2 === 0 ? "rotate-[-4deg]" : "rotate-[3deg] xl:translate-x-4"}
        >
          <Card order={order} />
        </div>
      ))}
    </div>
  );
}

/**
 * Spotlight.
 *
 * One column down the middle, with the panel's own work floating either side
 * of it — the shape this market's better-known landings use, because it puts
 * the claim and the evidence for it in the same glance.
 *
 * The difference is in the cards. The pages this borrows its shape from float
 * invented dashboards: a follower chart nobody's account produced, half a
 * million dollars of net sales belonging to no one. These are real orders off
 * this panel, anonymised — a service, a quantity, how long it took. A panel
 * in its first week floats one card, or none, which is the honest thing for
 * it to show and the reason none of this is decoration.
 */
export default function Spotlight(props: LayoutProps) {
  const { data, t, currency, locale, settings, signedIn } = props;
  const count = new Intl.NumberFormat(localeTag(locale));

  // Finished first: a card that says how long delivery took is worth more
  // than one still counting down. Then one card per service — four cards all
  // naming the same service read as one card printed four times, which is
  // what a made-up page looks like.
  const done = data.recent.filter((o) => o.seconds !== null);
  const running = data.recent.filter((o) => o.seconds === null);
  const seen = new Set<string>();
  // Not padded back out to four. A panel that has sold two services floats
  // two cards; filling the other two sides by repeating them mirrors the same
  // order across the page, which reads worse than an empty margin and is the
  // exact impression this layout is meant not to give.
  const cards = [...done, ...running].filter((o) => !seen.has(o.service) && seen.add(o.service)).slice(0, 4);

  const elapsed = (seconds: number) => {
    if (seconds < 90) return t("time.seconds", { n: seconds });
    const minutes = Math.round(seconds / 60);
    if (minutes < 90) return t("time.minutes", { n: minutes });
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? t("time.hoursMinutes", { h: hours, m: rest }) : t("time.hours", { n: hours });
  };

  const Card = ({ order }: { order: RecentDelivery }) => (
    <article className="card w-[17.5rem] px-4 py-3.5 shadow-lg">
      <header className="flex items-center gap-2.5">
        {order.platform ? (
          <PlatformMark platform={order.platform} size={15} box={30} />
        ) : (
          <span className="surface-2 flex h-[30px] w-[30px] items-center justify-center rounded-xl">
            <Icon name="cart" size={15} />
          </span>
        )}
          <span className="min-w-0 flex-1 text-sm leading-snug font-semibold">{order.service}</span>
        <span className={order.seconds === null ? "badge badge-info" : "badge badge-success"}>
          {order.seconds === null ? t("status.inprogress") : t("status.completed")}
        </span>
      </header>

      <p className="muted mt-3 flex items-baseline justify-between text-xs">
        <span className="font-mono text-base font-semibold text-[var(--text)] tabular-nums">
          {count.format(order.quantity)}
        </span>
        {order.seconds !== null && <span>{elapsed(order.seconds)}</span>}
      </p>

      {/* A bar rather than a percentage: the panel knows the order finished,
          not how far along a running one is, and a made-up percentage is
          exactly the kind of thing this layout exists to avoid. */}
      <span className="surface-2 mt-2.5 block h-1.5 overflow-hidden rounded-full">
        <span
          className="block h-full rounded-full"
          style={{
            width: order.seconds === null ? "45%" : "100%",
            background: order.seconds === null ? "var(--accent)" : "var(--success)",
          }}
        />
      </span>
    </article>
  );

  return (
    <>
      <section className="relative overflow-hidden">
        {/* A single soft wash behind the middle of the page, so the floating
            cards read as sitting above something rather than adrift. */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-[-18rem] left-1/2 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full opacity-[0.16]"
          style={{ background: "radial-gradient(closest-side, var(--primary), transparent)" }}
        />

        {/* Three columns once there is room, so a card cannot land on the
            headline: at 1440 the absolutely positioned version did exactly
            that. The middle column is the only one that holds text, and its
            width is fixed rather than shared. */}
        <div className="container-page relative grid gap-10 pt-14 pb-10 sm:pt-20 xl:grid-cols-[1fr_minmax(0,40rem)_1fr] xl:items-start xl:gap-8">
          <FloatColumn cards={cards} side="left" Card={Card} />

          <div className="mx-auto max-w-2xl text-center xl:max-w-none">
            {data.serviceCount > 0 && (
              <p className="surface-2 muted mx-auto inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm">
                <span className="text-[var(--primary)]">
                  <Icon name="layers" size={14} />
                </span>
                {t("landing.spot.badge", { n: count.format(data.serviceCount) })}
              </p>
            )}

            <h1 className="mt-5 text-4xl leading-[1.08] font-extrabold tracking-[-0.03em] sm:text-6xl">
              {t("landing.spot.title")}
              <span className="text-[var(--primary)]"> {t("landing.spot.titleAccent")}</span>
            </h1>

            <p className="muted mx-auto mt-5 max-w-lg text-lg leading-relaxed">{t("landing.spot.sub")}</p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {signedIn ? (
                <Link href="/dashboard/new-order" className="btn btn-primary btn-lg">
                  {t("dash.newOrder")}
                  <Icon name="arrowRight" size={16} />
                </Link>
              ) : (
                <>
                  <Link href="/register" className="btn btn-primary btn-lg">
                    {t("landing.spot.cta")}
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

            <div className="mt-10 flex flex-wrap justify-center gap-4 xl:hidden">
              {cards.slice(0, 2).map((o) => (
                <Card key={o.id} order={o} />
              ))}
            </div>
          </div>

          <FloatColumn cards={cards} side="right" Card={Card} />

          <div className="flex justify-center xl:col-span-3">
            <Pills t={t} />
          </div>
        </div>
      </section>

      <PlatformStrip platforms={data.platforms} label={t("landing.hero.platforms")} />
      <Steps t={t} />
      <Quotes quotes={data.quotes} title={t("landing.quotes.title")} />
      <Faqs questions={data.questions} title={t("landing.faq.title")} />
      <PaymentStrip payments={data.payments} title={t("landing.pay.title")} note={t("landing.pay.note")} />
      <ClosingCta t={t} settings={settings} />
    </>
  );
}
