import { localeTag } from "@/lib/numbers";
import Link from "next/link";
import { Icon } from "@/components/icons";
import PlatformMark from "@/components/platform-mark";
import { displayMoney } from "@/lib/currency";
import PlatformField from "./platform-field";
import { ClosingCta, Faqs, PaymentStrip, Quotes, Steps } from "./sections";
import type { LayoutProps } from "./types";

/**
 * Grid.
 *
 * A ruled plane with the platforms scattered across it and the claim in the
 * middle. The device says the thing the sentence would otherwise have to:
 * this panel covers all of these, and they are all the same kind of work.
 *
 * The marks are not pinned to the grid's cells. They sit where the field puts
 * them, shy away from the pointer and move on when tapped — see
 * platform-field.tsx.
 *
 * Below the fold, where pages of this shape usually paste a screenshot of a
 * dashboard, is the actual board — the catalogue this panel is selling today,
 * priced for whoever is reading. A screenshot goes stale the week after it is
 * taken and cannot be read on a phone; a table is current by construction.
 */
export default function Grid(props: LayoutProps) {
  const { data, t, currency, locale, settings, signedIn } = props;
  const count = new Intl.NumberFormat(localeTag(locale));

  return (
    <>
      <section className="relative overflow-hidden border-b border-[var(--border)]">
        {/* The grid itself: two hairline gradients rather than an image, so it
            follows the theme's border colour and costs nothing to load. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
            backgroundSize: "7.5rem 7.5rem",
            maskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, #000 40%, transparent 100%)",
          }}
        />

        <PlatformField platforms={data.platforms} />

        <div className="container-page relative py-16 sm:py-24">
          <div className="mx-auto max-w-[36rem]">
            <div className="text-center">
              {data.completedCount > 0 && (
                <p className="surface-2 muted mx-auto inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm">
                  <span className="text-[var(--success)]">
                    <Icon name="checkCircle" size={14} />
                  </span>
                  {t("landing.grid.badge", { n: count.format(data.completedCount) })}
                </p>
              )}

              <h1 className="mt-5 text-4xl leading-[1.1] font-extrabold tracking-[-0.03em] sm:text-5xl">
                {t("landing.grid.title")}
                <br />
                <span className="text-[var(--primary)]">{t("landing.grid.titleAccent")}</span>
              </h1>

              <p className="muted mx-auto mt-5 max-w-md text-lg leading-relaxed">{t("landing.grid.sub")}</p>

              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {signedIn ? (
                  <Link href="/dashboard/new-order" className="btn btn-primary btn-lg">
                    {t("dash.newOrder")}
                    <Icon name="arrowRight" size={16} />
                  </Link>
                ) : (
                  <>
                    <Link href="/register" className="btn btn-primary btn-lg">
                      {t("landing.grid.cta")}
                      <Icon name="arrowRight" size={16} />
                    </Link>
                    <Link href="/login" className="btn btn-ghost btn-lg">
                      {t("nav.signin")}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* The same platforms, in a row, for the widths where the cells are
              not on the page at all. */}
          <ul className="mt-10 flex flex-wrap justify-center gap-3 lg:hidden">
            {data.platforms.slice(0, 8).map((p) => (
              <li key={p.id} className="card flex items-center gap-2 px-3 py-2 text-sm font-medium">
                <PlatformMark platform={p} size={16} plain />
                {p.name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Where a screenshot would go. */}
      <section className="container-page py-14">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-extrabold tracking-[-0.02em] sm:text-3xl">{t("landing.grid.board")}</h2>
          <p className="muted mt-3 leading-relaxed">{t("landing.grid.boardSub")}</p>
        </div>

        <div className="card mt-8 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="surface-2">
                <tr className="muted text-left text-xs tracking-wider uppercase">
                  <th className="px-5 py-3 font-semibold">{t("order.platform")}</th>
                  <th className="px-5 py-3 font-semibold">{t("admin.services")}</th>
                  <th className="px-5 py-3 text-right font-semibold">{t("landing.grid.from")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.platforms.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-2.5 font-medium">
                        <PlatformMark platform={p} size={16} box={30} />
                        {p.name}
                      </span>
                    </td>
                    <td className="muted px-5 py-3.5 tabular-nums">{count.format(p.services)}</td>
                    <td className="px-5 py-3.5 text-right font-mono font-semibold tabular-nums">
                      {displayMoney(p.from, currency, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <Steps t={t} />
      <Quotes quotes={data.quotes} title={t("landing.quotes.title")} />
      <Faqs questions={data.questions} title={t("landing.faq.title")} />
      <PaymentStrip payments={data.payments} title={t("landing.pay.title")} note={t("landing.pay.note")} />
      <ClosingCta t={t} settings={settings} />
    </>
  );
}
