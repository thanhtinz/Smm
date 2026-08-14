import Link from "next/link";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { displayMoney } from "@/lib/currency";
import { Icon, type IconName } from "@/components/icons";
import StatCard from "@/components/ui/stat-card";
import StatusBadge from "@/components/ui/status-badge";
import { resolveTier } from "@/lib/pricing";

export default async function DashboardPage() {
  const ctx = await getAppContext();
  const user = ctx.user!;
  const { t, currency, locale } = ctx;

  const [activeCount, completedCount, recentOrders, notifications] = await Promise.all([
    db.order.count({ where: { userId: user.id, status: { in: ["pending", "processing", "inprogress"] } } }),
    db.order.count({ where: { userId: user.id, status: "completed" } }),
    db.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { service: { select: { name: true } } },
    }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 4 }),
  ]);

  const tier = await resolveTier(user);

  const quick: { href: string; label: string; icon: IconName }[] = [
    { href: "/dashboard/new-order", label: t("dash.newOrder"), icon: "cart" },
    { href: "/dashboard/wallet", label: t("dash.addFunds"), icon: "wallet" },
    { href: "/dashboard/tickets", label: t("dash.tickets"), icon: "ticket" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h2 className="flex flex-wrap items-center gap-2.5 text-2xl font-bold tracking-tight">
          <span>
            {t("dash.welcome")}, {user.username}
          </span>
          {tier && (
            <span
              className="badge"
              style={{
                color: tier.color,
                background: `color-mix(in srgb, ${tier.color} 16%, transparent)`,
                borderColor: `color-mix(in srgb, ${tier.color} 35%, transparent)`,
              }}
            >
              {tier.name}
              {tier.discountPercent > 0 && ` -${tier.discountPercent}%`}
            </span>
          )}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t("common.balance")} value={displayMoney(user.balance, currency, locale)} icon="wallet" />
        <StatCard label={t("dash.spent")} value={displayMoney(user.spent, currency, locale)} icon="trending" tone="accent" />
        <StatCard label={t("dash.activeOrders")} value={String(activeCount)} icon="clock" tone="warning" />
        <StatCard label={t("dash.completed")} value={String(completedCount)} icon="checkCircle" tone="success" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {quick.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="card flex items-center gap-3 px-5 py-4 font-semibold transition-transform hover:-translate-y-0.5"
          >
            <Icon name={q.icon} size={18} />
            <span className="flex-1">{q.label}</span>
            <Icon name="arrowRight" size={15} />
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section className="card overflow-hidden">
          <header className="flex items-center justify-between px-5 py-4">
            <h3 className="font-semibold">{t("dash.orders")}</h3>
            <Link href="/dashboard/orders" className="btn btn-ghost btn-sm">
              {t("common.all")}
              <Icon name="arrowRight" size={14} />
            </Link>
          </header>
          <div className="scroll-x">
            {recentOrders.length === 0 ? (
              <EmptyState label={t("common.none")} cta={{ href: "/dashboard/new-order", label: t("dash.newOrder") }} />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("order.id")}</th>
                    <th>{t("order.service")}</th>
                    <th>{t("order.quantity")}</th>
                    <th>{t("order.charge")}</th>
                    <th>{t("common.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => (
                    <tr key={o.id}>
                      <td className="font-mono text-xs">#{o.publicId}</td>
                      <td className="max-w-[22rem] truncate">{o.service.name}</td>
                      <td className="tabular-nums">{o.quantity.toLocaleString()}</td>
                      <td className="tabular-nums">{displayMoney(o.charge, currency, locale)}</td>
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

        <section className="card overflow-hidden">
          <header className="flex items-center justify-between gap-3 px-5 py-4">
            <h3 className="font-semibold">{t("dash.notifications")}</h3>
            <Link href="/dashboard/notifications" className="btn btn-ghost btn-sm">
              {t("notify.seeAll")}
            </Link>
          </header>
          <div className="divide-y divide-[var(--border)]">
            {notifications.length === 0 ? (
              <p className="muted px-5 py-8 text-center text-sm">{t("notify.empty")}</p>
            ) : (
              notifications.map((n) => {
                const body = (
                  <>
                    <span className={`mt-0.5 shrink-0 text-[var(--${n.level === "info" ? "accent" : n.level})]`}>
                      <Icon name={n.level === "success" ? "checkCircle" : n.level === "warning" ? "alert" : "info"} size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{n.title}</span>
                      <span className="muted mt-0.5 block text-xs leading-relaxed">{n.body}</span>
                    </span>
                  </>
                );
                // Every writer sets href — refunds point at the order, top-ups
                // at the wallet — so the card is a way through, not a dead end.
                return n.href ? (
                  <Link key={n.id} href={n.href} className="flex gap-3 px-5 py-4 hover:bg-[var(--surface2)]">
                    {body}
                  </Link>
                ) : (
                  <article key={n.id} className="flex gap-3 px-5 py-4">
                    {body}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function EmptyState({ label, cta }: { label: string; cta: { href: string; label: string } }) {
  return (
    <div className="px-5 py-12 text-center">
      <span className="muted inline-flex">
        <Icon name="package" size={30} />
      </span>
      <p className="muted mt-3 text-sm">{label}</p>
      <Link href={cta.href} className="btn btn-primary btn-sm mt-4">
        <Icon name="plus" size={15} />
        {cta.label}
      </Link>
    </div>
  );
}
