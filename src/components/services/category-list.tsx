import { Icon } from "@/components/icons";
import PlatformMark, { type PlatformLike } from "@/components/platform-mark";
import { displayMoney, type CurrencyInfo } from "@/lib/currency";

export type ListedService = {
  id: string;
  publicId: number;
  name: string;
  rate: number;
  min: number;
  max: number;
  refill: boolean;
  averageTime: string;
};

export type ListedCategory = {
  id: string;
  name: string;
  description: string;
  platform: PlatformLike | null;
  services: ListedService[];
};

/**
 * The price list.
 *
 * Shared by the whole catalogue and by each platform's own page, which is the
 * point of pulling it out: the two pages differ in what they say around the
 * prices, never in how a price is shown.
 */
export default function CategoryList({
  categories,
  currency,
  locale,
  labels,
  /** The platform is repeated on every row of a mixed list, and is redundant
   *  on a page that is about one platform already. */
  showPlatform = true,
}: {
  categories: ListedCategory[];
  currency: CurrencyInfo;
  locale: string;
  labels: Record<string, string>;
  showPlatform?: boolean;
}) {
  const count = new Intl.NumberFormat(locale === "vi" ? "vi-VN" : locale);

  return (
    <div className="space-y-6">
      {categories.map((category) => (
        <section key={category.id} className="card overflow-hidden">
          <header className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-5 py-4">
            {showPlatform && category.platform && <PlatformMark platform={category.platform} box={36} />}
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-semibold">{category.name}</h2>
              {category.description && <p className="muted truncate text-xs">{category.description}</p>}
            </div>
            <span className="badge badge-muted">{category.services.length}</span>
          </header>

          {/* Table on wide screens; the same rows become cards below md so
              the page never scrolls sideways. */}
          <div className="scroll-x hidden md:block">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-20">{labels.id}</th>
                  <th>{labels.service}</th>
                  <th className="w-40 text-right">{labels.rate}</th>
                  <th className="w-24 text-right">{labels.min}</th>
                  <th className="w-28 text-right">{labels.max}</th>
                  <th className="w-28">{labels.status}</th>
                </tr>
              </thead>
              <tbody>
                {category.services.map((s) => (
                  <tr key={s.id}>
                    <td className="muted font-mono text-xs">{s.publicId}</td>
                    <td>
                      <span className="font-medium">{s.name}</span>
                      {s.averageTime && (
                        <span className="muted mt-0.5 flex items-center gap-1 text-xs">
                          <Icon name="clock" size={12} />
                          {s.averageTime}
                        </span>
                      )}
                    </td>
                    <td className="text-right font-semibold tabular-nums">
                      {displayMoney(s.rate, currency, locale)}
                    </td>
                    <td className="muted text-right tabular-nums">{count.format(s.min)}</td>
                    <td className="muted text-right tabular-nums">{count.format(s.max)}</td>
                    <td>
                      {s.refill ? (
                        <span className="badge badge-success">
                          <Icon name="refresh" size={12} />
                          {labels.refill}
                        </span>
                      ) : (
                        <span className="badge badge-muted">
                          <Icon name="zap" size={12} />
                          {labels.standard}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-[var(--border)] md:hidden">
            {category.services.map((s) => (
              <li key={s.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{s.name}</p>
                  <span className="muted shrink-0 font-mono text-xs">{s.publicId}</span>
                </div>
                <dl className="mt-2.5 grid grid-cols-3 gap-2 text-xs">
                  <Cell label={labels.rate} value={displayMoney(s.rate, currency, locale)} strong />
                  <Cell label={labels.min} value={count.format(s.min)} />
                  <Cell label={labels.max} value={count.format(s.max)} />
                </dl>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Cell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="muted text-[0.65rem] tracking-wide uppercase">{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-semibold" : "muted"}`}>{value}</dd>
    </div>
  );
}
