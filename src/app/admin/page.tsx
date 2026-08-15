import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { displayMoney } from "@/lib/currency";
import { ACTIVE_ORDER_STATUSES } from "@/lib/orders";
import StatCard from "@/components/ui/stat-card";
import StatusBadge from "@/components/ui/status-badge";
import { Icon, type IconName } from "@/components/icons";
import SyncStatus, { type SyncView } from "@/components/admin/sync-status";
import { syncHealth } from "@/lib/sync-health";
import { getRootPanel, currentPanelId } from "@/lib/tenancy";
import { formatCount } from "@/lib/numbers";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminOverviewPage() {
  const ctx = await getAppContext();
  const { t, currency, locale } = ctx;

  const [userCount, orderCount, serviceCount, pendingOrders, revenue, deposits, recentOrders] = await Promise.all([
    db.user.count(),
    db.order.count(),
    db.service.count({ where: { enabled: true } }),
    db.order.count({ where: { status: { in: ACTIVE_ORDER_STATUSES } } }),
    db.order.aggregate({ _sum: { charge: true } }),
    db.transaction.aggregate({ _sum: { amount: true }, where: { type: "deposit", status: "completed" } }),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { service: { select: { name: true } }, user: { select: { username: true } } },
    }),
  ]);

  const [health, root, panelId] = await Promise.all([syncHealth(), getRootPanel(), currentPanelId()]);

  // Worded from the state rather than assembled from fragments: "never",
  // "quiet for 40 minutes" and "started and never finished" are three
  // different problems and each has its own sentence.
  const sync: SyncView = {
    tone: health.stale || health.unfinished ? "warn" : "ok",
    headline: health.unfinished
      ? t("sync.unfinished")
      : health.lastAt === null
        ? t("sync.never")
        : health.stale
          ? t("sync.stale", { n: health.ageMinutes ?? 0 })
          : (health.ageMinutes ?? 0) < 1
            ? t("sync.justNow")
            : t("sync.ok", { n: health.ageMinutes ?? 0 }),
    detail:
      health.lastAt === null
        ? ""
        : `${t("sync.counts", { dispatched: health.dispatched, synced: health.synced })}${
            health.trigger && health.trigger !== "cron" ? ` · ${t("sync.byHand")}` : ""
          }`,
    failures: health.failures,
    // One cycle covers every panel, so only the root panel's admin may start one.
    canRun: Boolean(root && root.id === panelId),
  };

  const shortcuts: { href: string; label: string; icon: IconName }[] = [
    { href: "/admin/platforms", label: t("admin.platforms"), icon: "globe" },
    { href: "/admin/categories", label: t("admin.categories"), icon: "layers" },
    { href: "/admin/services", label: t("admin.services"), icon: "package" },
    { href: "/admin/payment-methods", label: t("admin.paymentMethods"), icon: "wallet" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <h2 className="text-2xl font-bold tracking-tight">{t("admin.overview")}</h2>

      <SyncStatus
        view={sync}
        labels={{ runNow: t("sync.runNow"), running: t("sync.running"), failures: t("sync.failures") }}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t("admin.revenue")} value={displayMoney(revenue._sum.charge ?? 0, currency, locale)} icon="trending" />
        <StatCard
          label={t("wallet.deposit")}
          value={displayMoney(deposits._sum.amount ?? 0, currency, locale)}
          icon="wallet"
          tone="accent"
        />
        <StatCard label={t("dash.activeOrders")} value={String(pendingOrders)} icon="clock" tone="warning" />
        <StatCard label={t("admin.users")} value={String(userCount)} icon="users" tone="success" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {shortcuts.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="card flex items-center gap-3 px-5 py-4 font-semibold transition-transform hover:-translate-y-0.5"
          >
            <Icon name={s.icon} size={18} />
            <span className="flex-1">{s.label}</span>
            <Icon name="arrowRight" size={15} />
          </Link>
        ))}
      </div>

      <section className="card overflow-hidden">
        <header className="flex items-center justify-between px-5 py-4">
          <h3 className="font-semibold">{t("dash.orders")}</h3>
          <span className="muted text-sm tabular-nums">
            {orderCount} · {serviceCount} {t("admin.services.count")}
          </span>
        </header>
        <div className="scroll-x">
          {recentOrders.length === 0 ? (
            <p className="muted px-5 py-12 text-center text-sm">{t("common.none")}</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th className="w-24">{t("order.id")}</th>
                  <th className="w-36">{t("auth.username")}</th>
                  <th>{t("order.service")}</th>
                  <th className="w-28 text-right">{t("order.quantity")}</th>
                  <th className="w-28 text-right">{t("order.charge")}</th>
                  <th className="w-32">{t("common.status")}</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="font-mono text-xs">#{o.publicId}</td>
                    <td>{o.user.username}</td>
                    <td className="max-w-[20rem] truncate">{o.service.name}</td>
                    <td className="text-right tabular-nums">{formatCount(o.quantity, locale)}</td>
                    <td className="text-right tabular-nums">{displayMoney(o.charge, currency, locale)}</td>
                    <td>
                      <StatusBadge status={o.status} label={t(`status.${o.status}`)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
