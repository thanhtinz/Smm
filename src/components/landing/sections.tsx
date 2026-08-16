import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import PlatformMark from "@/components/platform-mark";
import { formatDigits, displayMoney, type CurrencyInfo } from "@/lib/currency";
import type { Quote, Question, PlatformLine } from "@/lib/landing";
import type { LandingProps } from "./types";

/**
 * The parts every layout in this genre shares.
 *
 * Commercial SMM panels all run the same furniture — a platform strip, a row
 * of counters, guarantee pills, three steps, quotes, an FAQ — and the layouts
 * differ in what they put above and how they order the rest. Keeping the
 * furniture here means a change to how a quote is set lands on all five.
 *
 * Two rules hold throughout: every count comes from a table, and a section
 * with nothing to show is not rendered at all. A young panel gets a shorter
 * page, not a page of placeholders.
 */

// ------------------------------------------------------------------ price

/**
 * A rate, in the words the reader thinks in.
 *
 * Panels quote per thousand because that is what the provider API deals in.
 * Buyers in this market quote per follow — "60đ/follow", not "60.000đ/1000" —
 * and reading a price they have to divide by a thousand is friction on the
 * one number the page exists to show. Which one leads is set in admin.
 */
export function rateLabel(
  ratePerThousand: number,
  currency: CurrencyInfo,
  locale: string,
  settings: Record<string, unknown>,
  t: LandingProps["t"],
): { amount: string; unit: string } {
  if (settings["landing.priceUnit"] === "per1000") {
    return { amount: displayMoney(ratePerThousand, currency, locale), unit: t("landing.board.per") };
  }

  // Per-unit prices are a thousandth of the stored rate, so a currency that
  // shows no decimals — VND — would round 1.200/1000 to "1đ" and lose the
  // difference between two services. Per-unit always allows two, and trailing
  // zeros are dropped so a round price still reads as a round price.
  const each = (ratePerThousand / 1000) * (currency.rate || 1);
  const digits = Math.max(currency.decimals, 2);

  // Below the smallest amount the currency can write, per-unit stops being a
  // price and becomes a zero: a dollar panel selling views at $0.02 per
  // thousand is $0.00002 each, which rounds to "$0" and tells the reader the
  // service is free. Quote it the way the catalogue stores it instead —
  // per 1,000 is what this market publishes anyway, and a true number in the
  // wrong unit beats a false one in the right one.
  if (each > 0 && each < 1 / 10 ** digits) {
    return { amount: displayMoney(ratePerThousand, currency, locale), unit: t("landing.board.per") };
  }

  // Punctuated by the currency, like every other price — with its own decimal
  // count rather than the currency's, since a per-unit price needs more places
  // than the currency has. Trailing zeros are dropped so a round price still
  // reads as a round one.
  const written = formatDigits(each, { ...currency, decimals: digits }).replace(/([.,]\d*?)0+$/, "$1").replace(/[.,]$/, "");
  const amount = currency.symbolBefore ? `${currency.symbol}${written}` : `${written}${currency.symbol}`;
  return { amount, unit: t("landing.board.perUnit") };
}

// --------------------------------------------------------------- platforms

/**
 * The platforms this panel sells for.
 *
 * They point at the order form rather than a public catalogue: the catalogue
 * lives inside the panel now, and the form redirects a signed-out reader to
 * sign in, which is where a landing page was trying to send them anyway.
 */
export function PlatformStrip({ platforms, label }: { platforms: PlatformLine[]; label: string }) {
  if (!platforms.length) return null;

  return (
    <section className="border-y border-[var(--border)] bg-[var(--surface)]">
      <div className="container-page flex flex-wrap items-center gap-x-3 gap-y-2 py-4">
        <span className="muted mr-1 text-xs font-semibold tracking-[0.16em] uppercase">{label}</span>
        {platforms.map((p) => (
          <Link
            key={p.id}
            href="/dashboard/new-order"
            className="flex items-center gap-2 rounded-full border border-[var(--border)] px-3.5 py-1.5 text-sm font-medium transition-colors hover:border-[color-mix(in_srgb,var(--primary)_50%,transparent)]"
          >
            <PlatformMark platform={p} size={16} />
            {p.name}
          </Link>
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ stats

/**
 * The counter row.
 *
 * Tinted with the theme's own accents rather than colours picked here, so it
 * keeps working across all five skins in both light and dark.
 */
export function StatTiles({ data, t }: Pick<LandingProps, "data" | "t"> & { locale?: string }) {
  const tiles: { k: string; v: number; tone: string; icon: IconName }[] = [
    { k: t("landing.stat.orders"), v: data.completedCount, tone: "var(--primary)", icon: "checkCircle" },
    { k: t("landing.stat.services"), v: data.serviceCount, tone: "var(--accent)", icon: "layers" },
    { k: t("landing.stat.users"), v: data.userCount, tone: "var(--success)", icon: "users" },
    { k: t("order.platform"), v: data.platforms.length, tone: "var(--warning)", icon: "globe" },
  ];

  return (
    <section className="container-page py-10">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((s) => (
          <div
            key={s.k}
            className="rounded-[var(--radius)] border p-5"
            style={{
              borderColor: `color-mix(in srgb, ${s.tone} 35%, transparent)`,
              background: `linear-gradient(160deg, color-mix(in srgb, ${s.tone} 16%, transparent), transparent 70%)`,
            }}
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: `color-mix(in srgb, ${s.tone} 20%, transparent)`, color: s.tone }}
            >
              <Icon name={s.icon} size={19} />
            </span>
            <dd className="mt-4 font-mono text-3xl leading-none font-bold">{s.v.toLocaleString("en-US")}</dd>
            <dt className="muted mt-2 text-sm">{s.k}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ------------------------------------------------------------------ pills

export function Pills({ t }: Pick<LandingProps, "t">) {
  const pills: { icon: IconName; label: string }[] = [
    { icon: "zap", label: t("landing.trust.speed") },
    { icon: "refresh", label: t("landing.trust.refill") },
    { icon: "creditCard", label: t("landing.trust.pay") },
    { icon: "ticket", label: t("landing.trust.support") },
    { icon: "code", label: t("landing.trust.api") },
  ];

  return (
    <ul className="flex flex-wrap gap-2">
      {pills.map((p) => (
        <li
          key={p.label}
          className="surface-2 flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium"
        >
          <span className="text-[var(--primary)]">
            <Icon name={p.icon} size={15} />
          </span>
          {p.label}
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------ steps

export function Steps({ t }: Pick<LandingProps, "t">) {
  const steps: { icon: IconName; title: string; body: string }[] = [
    { icon: "user", title: t("landing.howto.1.title"), body: t("landing.howto.1.body") },
    { icon: "wallet", title: t("landing.howto.2.title"), body: t("landing.howto.2.body") },
    { icon: "rocket", title: t("landing.howto.3.title"), body: t("landing.howto.3.body") },
  ];

  return (
    <section className="container-page py-14">
      <h2 className="text-center text-2xl font-extrabold tracking-[-0.02em] sm:text-4xl">
        {t("landing.steps.title")}
      </h2>

      {/* Numbered because these genuinely run in order — you cannot place an
          order before the balance is there. */}
      <ol className="mt-10 grid gap-5 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="card card-pad relative px-6 py-7">
            <span className="muted absolute top-5 right-6 font-mono text-3xl font-bold opacity-25">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] text-[var(--primary)]">
              <Icon name={s.icon} size={22} />
            </span>
            <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
            <p className="muted mt-2 leading-relaxed">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ----------------------------------------------------------------- quotes

/**
 * Five stars, inked in as far as the rating goes.
 *
 * Drawing only as many stars as the rating meant four and five were told
 * apart by counting, and outlines meant a full mark and a low one looked
 * alike at a glance. A row of five with the score inked into it is read
 * rather than counted.
 */
function Stars({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="flex gap-0.5" aria-label={`${n}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < n ? "text-[var(--warning)]" : "muted opacity-30"}>
          <Icon name={i < n ? "starFilled" : "star"} size={14} />
        </span>
      ))}
    </span>
  );
}

export function Quotes({ quotes, title }: { quotes: Quote[]; title: string }) {
  if (!quotes.length) return null;

  return (
    <section className="container-page py-14">
      <h2 className="text-center text-2xl font-extrabold tracking-[-0.02em] sm:text-4xl">{title}</h2>

      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {quotes.map((q) => (
          <figure key={q.id} className="card card-pad flex flex-col px-6 py-6">
            <Stars n={q.rating} />
            <blockquote className="mt-3 flex-1 leading-relaxed">{q.body}</blockquote>
            <figcaption className="mt-5 flex items-center gap-3 border-t border-[var(--border)] pt-4">
              {q.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={q.avatar} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <span className="surface-2 muted flex h-10 w-10 items-center justify-center rounded-full">
                  <Icon name="user" size={18} />
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate font-semibold">{q.name}</span>
                {q.role && <span className="muted block truncate text-xs">{q.role}</span>}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

// -------------------------------------------------------------------- faq

export function Faqs({ questions, title }: { questions: Question[]; title: string }) {
  if (!questions.length) return null;

  return (
    <section className="container-page py-14">
      <h2 className="text-center text-2xl font-extrabold tracking-[-0.02em] sm:text-4xl">{title}</h2>

      {/* <details> rather than a scripted accordion: it opens without
          JavaScript, and the browser already handles the keyboard. */}
      <div className="mt-10 grid gap-3 md:grid-cols-2">
        {questions.map((q) => (
          <details key={q.id} className="card group px-5 py-4 open:pb-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
              {q.question}
              <span className="muted shrink-0 transition-transform group-open:rotate-180">
                <Icon name="chevronDown" size={17} />
              </span>
            </summary>
            <p className="muted mt-3 leading-relaxed whitespace-pre-line">{q.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

// --------------------------------------------------------------- payments

export function PaymentStrip({
  payments,
  title,
  note,
}: {
  payments: { id: string; name: string; icon: string }[];
  title: string;
  note: string;
}) {
  if (!payments.length) return null;

  return (
    <section className="container-page py-10">
      <div className="card card-pad flex flex-wrap items-center gap-x-6 gap-y-4 px-6 py-6">
        <div className="mr-auto">
          <h2 className="font-semibold">{title}</h2>
          <p className="muted mt-1 text-sm">{note}</p>
        </div>
        <ul className="flex flex-wrap gap-2">
          {payments.map((m) => (
            <li
              key={m.id}
              className="surface-2 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium"
            >
              <span className="text-[var(--primary)]">
                <Icon name={m.icon as IconName} size={17} />
              </span>
              {m.name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Refill and stated-time badges, both read off the platform's services. */
export function QualityTags({ platform, t }: { platform: PlatformLine; t: LandingProps["t"] }) {
  if (!platform.refill && !platform.timed) return null;

  return (
    <span className="flex flex-wrap gap-1.5">
      {platform.refill && (
        <span className="badge badge-success gap-1">
          <Icon name="shield" size={12} />
          {t("landing.tag.refill")}
        </span>
      )}
      {platform.timed > 0 && (
        <span className="badge badge-muted gap-1">
          <Icon name="clock" size={12} />
          {t("landing.tag.timed")}
        </span>
      )}
    </span>
  );
}

// ------------------------------------------------------------------- foot

export function ClosingCta({ t, settings }: Pick<LandingProps, "t" | "settings">) {
  return (
    <section className="container-page pb-16">
      <div
        className="flex flex-wrap items-center justify-between gap-5 rounded-[var(--radius)] border border-[var(--border)] px-8 py-10"
        style={{
          background:
            "linear-gradient(120deg, color-mix(in srgb, var(--primary) 18%, transparent), color-mix(in srgb, var(--accent) 14%, transparent))",
        }}
      >
        <div>
          <h2 className="text-2xl font-extrabold tracking-[-0.02em] sm:text-3xl">{t("landing.cta.final.title")}</h2>
          <p className="muted mt-2">{(settings["site.supportEmail"] as string) || t("landing.cta.final.body")}</p>
        </div>
        <Link href="/register" className="btn btn-primary btn-lg">
          {t("landing.cta.primary")}
          <Icon name="arrowRight" size={17} />
        </Link>
      </div>
    </section>
  );
}
