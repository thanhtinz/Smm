import { pageTitle } from "@/lib/page-title";
import Link from "next/link";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { dateFormats, type DateFormats } from "@/lib/dates";
import { displayMoney } from "@/lib/currency";
import { Icon, type IconName } from "@/components/icons";
import StatusBadge from "@/components/ui/status-badge";

export const generateMetadata = pageTitle("wallet.history");

const PAGE_SIZE = 25;

const TYPE_ICON: Record<string, IconName> = {
  deposit: "wallet",
  order: "cart",
  refund: "refresh",
  bonus: "gift",
  admin_credit: "plus",
  admin_debit: "minus",
};

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; page?: string }>;
}) {
  const params = await searchParams;
  const ctx = await getAppContext();
  const user = ctx.user!;
  const { t, currency, locale, timezone } = ctx;
  const dates = dateFormats(locale, timezone);

  const types = ["deposit", "order", "refund", "bonus", "rent", "admin_credit", "admin_debit"];
  const type = types.includes(params.type ?? "") ? params.type : undefined;
  const page = Math.max(1, Number(params.page) || 1);

  const where = { userId: user.id, ...(type ? { type } : {}) };
  const [rows, total] = await Promise.all([
    db.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { method: { select: { name: true } } },
    }),
    db.transaction.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{t("wallet.history")}</h2>
        <div className="flex gap-2">
          <a href={`/api/export/transactions${type ? `?type=${type}` : ""}`} className="btn btn-ghost btn-sm">
            <Icon name="download" size={15} />
            {t("common.export")}
          </a>
          <Link href="/dashboard/wallet" className="btn btn-primary btn-sm">
            <Icon name="plus" size={15} />
            {t("dash.addFunds")}
          </Link>
        </div>
      </div>

      <div className="scroll-x -mx-1 px-1">
        <div className="flex gap-2 pb-1">
          <Tab href="/dashboard/transactions" active={!type} label={t("common.all")} />
          {types.map((ty) => (
            <Tab
              key={ty}
              href={`/dashboard/transactions?type=${ty}`}
              active={type === ty}
              label={t(`tx.${ty}`)}
            />
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <span className="muted inline-flex">
              <Icon name="creditCard" size={32} />
            </span>
            <p className="muted mt-3 text-sm">{t("common.none")}</p>
          </div>
        ) : (
          <>
            <div className="scroll-x hidden md:block">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-24">{t("order.id")}</th>
                    <th className="w-40">{t("wallet.type")}</th>
                    <th>{t("wallet.method")}</th>
                    <th className="w-36 text-right">{t("common.amount")}</th>
                    <th className="w-32">{t("common.status")}</th>
                    <th className="w-36">{t("common.date")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="font-mono text-xs">#{r.publicId}</td>
                      <td>
                        <span className="flex items-center gap-2">
                          <Icon name={TYPE_ICON[r.type] ?? "info"} size={15} />
                          {t(`tx.${r.type}`)}
                        </span>
                      </td>
                      <td className="muted max-w-[18rem] truncate">{r.method?.name ?? r.note ?? "—"}</td>
                      <td className={`text-right font-semibold tabular-nums ${r.amount < 0 ? "" : "text-[var(--success)]"}`}>
                        {r.amount < 0 ? "−" : "+"}
                        {displayMoney(Math.abs(r.amount), currency, locale)}
                      </td>
                      <td>
                        <StatusBadge status={r.status} label={t(`status.${r.status}`)} />
                      </td>
                      <td className="muted text-xs">{formatDate(r.createdAt, dates)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-[var(--border)] md:hidden">
              {rows.map((r) => (
                <li key={r.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Icon name={TYPE_ICON[r.type] ?? "info"} size={15} />
                      {t(`tx.${r.type}`)}
                    </span>
                    <span className={`font-semibold tabular-nums ${r.amount < 0 ? "" : "text-[var(--success)]"}`}>
                      {r.amount < 0 ? "−" : "+"}
                      {displayMoney(Math.abs(r.amount), currency, locale)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <StatusBadge status={r.status} label={t(`status.${r.status}`)} />
                    <span className="muted font-mono text-xs">#{r.publicId}</span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {totalPages > 1 && (
        <nav className="flex items-center justify-between" aria-label={t("common.pagination")}>
          <PageLink href={buildPage(type, page - 1)} disabled={page <= 1} icon="chevronLeft" />
          <span className="muted text-sm tabular-nums">
            {page} / {totalPages}
          </span>
          <PageLink href={buildPage(type, page + 1)} disabled={page >= totalPages} icon="chevronRight" />
        </nav>
      )}
    </div>
  );
}

function buildPage(type: string | undefined, page: number) {
  const sp = new URLSearchParams();
  if (type) sp.set("type", type);
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `/dashboard/transactions?${qs}` : "/dashboard/transactions";
}

function Tab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] text-[var(--primary)]"
          : "muted border-[var(--border)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
      }`}
    >
      {label}
    </Link>
  );
}

function PageLink({ href, disabled, icon }: { href: string; disabled: boolean; icon: "chevronLeft" | "chevronRight" }) {
  if (disabled) {
    return (
      <span className="btn btn-ghost btn-sm opacity-40" aria-disabled>
        <Icon name={icon} size={15} />
      </span>
    );
  }
  return (
    <Link href={href} className="btn btn-ghost btn-sm">
      <Icon name={icon} size={15} />
    </Link>
  );
}

function formatDate(date: Date, dates: DateFormats) {
  return dates.full(date);
}
