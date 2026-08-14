import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { displayMoney } from "@/lib/currency";
import StatCard from "@/components/ui/stat-card";
import StatusBadge from "@/components/ui/status-badge";
import TrendChart, { type TrendPoint } from "@/components/admin/trend-chart";

export const metadata: Metadata = { title: "Statistics" };

type Bucket = { revenue: number; cost: number; profit: number; orders: number; deposits: number; users: number };

/** Money that went back to the customer, so it was never earned. */
const REFUNDED = new Set(["canceled", "refunded"]);

const WINDOWS = [7, 30, 90] as const;

export default async function AdminStatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const params = await searchParams;
  const { t, currency, locale } = await getAppContext();

  const days = WINDOWS.includes(Number(params.days) as (typeof WINDOWS)[number]) ? Number(params.days) : 30;
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const [orders, deposits, users, byStatus, topServices] = await Promise.all([
    db.order.findMany({
      where: { createdAt: { gte: since } },
      // Refunded and cancelled orders are excluded from profit further down;
      // they are still counted as orders placed.
      select: { createdAt: true, charge: true, cost: true, status: true, serviceId: true },
    }),
    db.transaction.findMany({
      where: { createdAt: { gte: since }, type: "deposit", status: "completed" },
      select: { createdAt: true, amount: true },
    }),
    db.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    db.order.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    // Refunded orders are left out here too, so this table cannot disagree
    // with the profit one beside it.
    db.order.groupBy({
      by: ["serviceId"],
      where: { createdAt: { gte: since }, status: { notIn: [...REFUNDED] } },
      _sum: { charge: true },
      _count: { _all: true },
      orderBy: { _sum: { charge: "desc" } },
      take: 8,
    }),
  ]);

  // One bucket per day, including the days with nothing in them — a gap in the
  // series would otherwise read as a shorter period rather than a quiet one.
  const key = (d: Date) => d.toISOString().slice(0, 10);
  const buckets = new Map<string, Bucket>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    buckets.set(key(d), { revenue: 0, cost: 0, profit: 0, orders: 0, deposits: 0, users: 0 });
  }

  // Profit only counts orders that were both paid for and have a recorded
  // cost. An order refunded to the customer earned nothing, and one placed
  // before the cost was recorded — or on a service fulfilled by hand — would
  // otherwise read as pure margin.
  let unpriced = 0;
  for (const o of orders) {
    const b = buckets.get(key(o.createdAt));
    if (!b) continue;
    b.orders += 1;
    if (REFUNDED.has(o.status)) continue;
    b.revenue += o.charge;
    if (o.cost === null) {
      unpriced += 1;
      continue;
    }
    b.cost += o.cost;
    b.profit += o.charge - o.cost;
  }
  for (const d of deposits) {
    const b = buckets.get(key(d.createdAt));
    if (b) b.deposits += d.amount;
  }
  for (const u of users) {
    const b = buckets.get(key(u.createdAt));
    if (b) b.users += 1;
  }

  const short = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : locale, { day: "2-digit", month: "2-digit" });
  const series = (pick: (b: Bucket) => number): TrendPoint[] =>
    [...buckets.entries()].map(([day, b]) => ({ day: short.format(new Date(`${day}T00:00:00`)), value: pick(b) }));

  const money = (n: number) => displayMoney(n, currency, locale);
  const totals = [...buckets.values()].reduce(
    (acc, b) => ({
      revenue: acc.revenue + b.revenue,
      cost: acc.cost + b.cost,
      profit: acc.profit + b.profit,
      orders: acc.orders + b.orders,
      deposits: acc.deposits + b.deposits,
      users: acc.users + b.users,
    }),
    { revenue: 0, cost: 0, profit: 0, orders: 0, deposits: 0, users: 0 },
  );
  // Against the revenue that had a cost, not all revenue — otherwise orders
  // with no recorded cost would drag the margin down as if they were free.
  const priced = totals.cost + totals.profit;
  const margin = priced > 0 ? Math.round((totals.profit / priced) * 100) : 0;

  // Per service, from the same rows, so the table cannot disagree with the
  // totals above it.
  const perService = new Map<string, { priced: number; profit: number; orders: number }>();
  for (const o of orders) {
    if (REFUNDED.has(o.status)) continue;
    const row = perService.get(o.serviceId) ?? { priced: 0, profit: 0, orders: 0 };
    row.orders += 1;
    // `priced` is the revenue that had a cost, the same basis as the margin
    // above — otherwise an order with no recorded cost reads as zero margin.
    if (o.cost !== null) {
      row.priced += o.charge;
      row.profit += o.charge - o.cost;
    }
    perService.set(o.serviceId, row);
  }
  const topProfit = [...perService.entries()]
    .filter(([, row]) => row.priced > 0)
    .sort((a, b) => b[1].profit - a[1].profit)
    .slice(0, 8);

  const serviceNames = new Map(
    (
      await db.service.findMany({
        where: { id: { in: [...topServices.map((s) => s.serviceId), ...topProfit.map(([id]) => id)] } },
        select: { id: true, name: true, publicId: true },
      })
    ).map((s) => [s.id, s]),
  );

  const orderTotal = byStatus.reduce((n, s) => n + s._count._all, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{t("admin.statistics")}</h2>
        <div className="flex gap-2">
          {WINDOWS.map((w) => (
            <Link
              key={w}
              href={`/admin/statistics?days=${w}`}
              className={days === w ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
            >
              {w}
              {t("panel.days")}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t("admin.revenue")} value={money(totals.revenue)} icon="trending" />
        <StatCard label={t("stats.cost")} value={money(totals.cost)} icon="server" tone="warning" />
        <StatCard label={t("stats.profit")} value={money(totals.profit)} icon="wallet" tone="success" />
        <StatCard label={t("stats.margin")} value={`${margin}%`} icon="trending" tone="accent" />
      </div>

      {unpriced > 0 && (
        <p className="muted text-sm">{t("stats.unpriced").replace("{count}", String(unpriced))}</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t("wallet.deposit")} value={money(totals.deposits)} icon="wallet" tone="accent" />
        <StatCard label={t("dash.orders")} value={String(totals.orders)} icon="list" tone="warning" />
        <StatCard label={t("stats.newUsers")} value={String(totals.users)} icon="users" tone="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TrendChart points={series((b) => b.revenue)} label={t("admin.revenue")} format={money} />
        <TrendChart
          points={series((b) => b.profit)}
          label={t("stats.profit")}
          format={money}
          tone="var(--success)"
        />
        <TrendChart
          points={series((b) => b.deposits)}
          label={t("wallet.deposit")}
          format={money}
          tone="var(--accent)"
        />
        <TrendChart points={series((b) => b.orders)} label={t("dash.orders")} format={String} tone="var(--warning)" />
        <TrendChart points={series((b) => b.users)} label={t("stats.newUsers")} format={String} tone="var(--success)" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <h3 className="border-b border-[var(--border)] p-4 font-semibold sm:px-5">{t("stats.byStatus")}</h3>
          {byStatus.length === 0 ? (
            <p className="muted px-5 py-10 text-center text-sm">{t("common.none")}</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {byStatus
                .sort((a, b) => b._count._all - a._count._all)
                .map((row) => (
                  <li key={row.status} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <StatusBadge status={row.status} label={t(`status.${row.status}`)} />
                    <span className="muted ml-auto text-xs tabular-nums">
                      {orderTotal ? Math.round((row._count._all / orderTotal) * 100) : 0}%
                    </span>
                    <span className="w-10 text-right font-semibold tabular-nums">{row._count._all}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>

        <div className="card overflow-hidden">
          <h3 className="border-b border-[var(--border)] p-4 font-semibold sm:px-5">{t("stats.topProfit")}</h3>
          {topProfit.length === 0 ? (
            <p className="muted px-5 py-10 text-center text-sm">{t("common.none")}</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {topProfit.map(([serviceId, row]) => {
                const service = serviceNames.get(serviceId);
                const share = row.priced > 0 ? Math.round((row.profit / row.priced) * 100) : 0;
                return (
                  <li key={serviceId} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{service?.name ?? "—"}</span>
                      <span className="muted font-mono text-xs">#{service?.publicId}</span>
                    </span>
                    <span className="muted shrink-0 text-xs tabular-nums">{share}%</span>
                    <span className="shrink-0 text-right font-semibold tabular-nums">{money(row.profit)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card overflow-hidden">
          <h3 className="border-b border-[var(--border)] p-4 font-semibold sm:px-5">{t("stats.topServices")}</h3>
          {topServices.length === 0 ? (
            <p className="muted px-5 py-10 text-center text-sm">{t("common.none")}</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {topServices.map((row) => {
                const service = serviceNames.get(row.serviceId);
                return (
                  <li key={row.serviceId} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{service?.name ?? "—"}</span>
                      <span className="muted font-mono text-xs">#{service?.publicId}</span>
                    </span>
                    <span className="muted shrink-0 text-xs tabular-nums">{row._count._all}</span>
                    <span className="shrink-0 text-right font-semibold tabular-nums">{money(row._sum.charge ?? 0)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
