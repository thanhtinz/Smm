import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { displayMoney } from "@/lib/currency";
import { Icon } from "@/components/icons";
import StatusBadge from "@/components/ui/status-badge";
import OrderActions from "@/components/orders/order-actions";
import { ORDER_STATUSES } from "@/lib/orders";

export const metadata: Metadata = { title: "Orders" };

const PAGE_SIZE = 25;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const ctx = await getAppContext();
  const user = ctx.user!;
  const { t, currency, locale } = ctx;

  const status = ORDER_STATUSES.includes(params.status as never) ? params.status : undefined;
  const page = Math.max(1, Number(params.page) || 1);

  const where = { userId: user.id, ...(status ? { status } : {}) };
  const [orders, total, counts] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        service: { select: { name: true, refill: true, cancel: true } },
        requests: { where: { status: { in: ["pending", "approved"] } }, select: { type: true } },
      },
    }),
    db.order.count({ where }),
    db.order.groupBy({ by: ["status"], where: { userId: user.id }, _count: true }),
  ]);

  const countFor = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const requestLabels = {
    refill: t("order.refill"),
    cancel: t("order.cancel"),
    refillPending: t("order.refillPending"),
    cancelPending: t("order.cancelPending"),
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{t("dash.orders")}</h2>
        <Link href="/dashboard/new-order" className="btn btn-primary btn-sm">
          <Icon name="plus" size={15} />
          {t("dash.newOrder")}
        </Link>
      </div>

      <div className="scroll-x -mx-1 px-1">
        <div className="flex gap-2 pb-1">
          <Tab href="/dashboard/orders" active={!status} label={t("common.all")} count={counts.reduce((n, c) => n + c._count, 0)} />
          {ORDER_STATUSES.map((s) => (
            <Tab
              key={s}
              href={`/dashboard/orders?status=${s}`}
              active={status === s}
              label={t(`status.${s}`)}
              count={countFor(s)}
            />
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {orders.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <span className="muted inline-flex">
              <Icon name="package" size={32} />
            </span>
            <p className="muted mt-3 text-sm">{t("common.none")}</p>
            <Link href="/dashboard/new-order" className="btn btn-primary btn-sm mt-4">
              <Icon name="plus" size={15} />
              {t("dash.newOrder")}
            </Link>
          </div>
        ) : (
          <>
            <div className="scroll-x hidden md:block">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-24">{t("order.id")}</th>
                    <th>{t("order.service")}</th>
                    <th className="w-56">{t("order.link")}</th>
                    <th className="w-28 text-right">{t("order.quantity")}</th>
                    <th className="w-28 text-right">{t("order.charge")}</th>
                    <th className="w-32">{t("common.status")}</th>
                    <th className="w-32">{t("common.date")}</th>
                    <th className="w-40 text-right">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="font-mono text-xs">#{o.publicId}</td>
                      <td className="max-w-[20rem]">
                        <p className="truncate">{o.service.name}</p>
                        {o.comments && (
                          <details className="mt-1">
                            <summary className="muted cursor-pointer text-xs">{t("order.comments")}</summary>
                            <pre className="surface-2 mt-1 max-h-40 overflow-auto rounded-lg p-2 text-xs whitespace-pre-wrap">
                              {o.comments}
                            </pre>
                          </details>
                        )}
                      </td>
                      <td className="max-w-[14rem] truncate">
                        <a href={o.link} target="_blank" rel="noopener noreferrer" className="muted hover:text-[var(--text)]">
                          {o.link}
                        </a>
                      </td>
                      <td className="text-right tabular-nums">{o.quantity.toLocaleString()}</td>
                      <td className="text-right tabular-nums">{displayMoney(o.charge, currency, locale)}</td>
                      <td>
                        <StatusBadge status={o.status} label={t(`status.${o.status}`)} />
                      </td>
                      <td className="muted text-xs">{formatDate(o.createdAt, locale)}</td>
                      <td>
                        <OrderActions
                          order={{
                            orderId: o.id,
                            canRefill: o.service.refill && ["completed", "partial"].includes(o.status),
                            canCancel: o.service.cancel && ["pending", "processing"].includes(o.status),
                            openRequest: o.requests[0]?.type ?? null,
                          }}
                          labels={requestLabels}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-[var(--border)] md:hidden">
              {orders.map((o) => (
                <li key={o.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-mono text-xs">#{o.publicId}</span>
                    <StatusBadge status={o.status} label={t(`status.${o.status}`)} />
                  </div>
                  <p className="mt-1.5 text-sm font-medium">{o.service.name}</p>
                  <p className="muted mt-0.5 truncate text-xs">{o.link}</p>
                  {o.comments && (
                    <details className="mt-1.5">
                      <summary className="muted cursor-pointer text-xs">{t("order.comments")}</summary>
                      <pre className="surface-2 mt-1 max-h-40 overflow-auto rounded-lg p-2 text-xs whitespace-pre-wrap">
                        {o.comments}
                      </pre>
                    </details>
                  )}
                  <div className="mt-2.5 flex items-center justify-between gap-3 text-xs">
                    <span className="muted tabular-nums">{o.quantity.toLocaleString()}</span>
                    <span className="font-semibold tabular-nums">{displayMoney(o.charge, currency, locale)}</span>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <OrderActions
                      order={{
                        orderId: o.id,
                        canRefill: o.service.refill && ["completed", "partial"].includes(o.status),
                        canCancel: o.service.cancel && ["pending", "processing"].includes(o.status),
                        openRequest: o.requests[0]?.type ?? null,
                      }}
                      labels={requestLabels}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {totalPages > 1 && (
        <nav className="flex items-center justify-between" aria-label="Pagination">
          <PageLink
            href={buildPage(status, page - 1)}
            disabled={page <= 1}
            icon="chevronLeft"
            label={t("common.all")}
          />
          <span className="muted text-sm tabular-nums">
            {page} / {totalPages}
          </span>
          <PageLink
            href={buildPage(status, page + 1)}
            disabled={page >= totalPages}
            icon="chevronRight"
            label={t("common.all")}
            trailing
          />
        </nav>
      )}
    </div>
  );
}

function buildPage(status: string | undefined, page: number) {
  const sp = new URLSearchParams();
  if (status) sp.set("status", status);
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `/dashboard/orders?${qs}` : "/dashboard/orders";
}

function Tab({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] text-[var(--primary)]"
          : "muted border-[var(--border)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
      }`}
    >
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </Link>
  );
}

function PageLink({
  href,
  disabled,
  icon,
  label,
  trailing,
}: {
  href: string;
  disabled: boolean;
  icon: "chevronLeft" | "chevronRight";
  label: string;
  trailing?: boolean;
}) {
  if (disabled) {
    return (
      <span className="btn btn-ghost btn-sm opacity-40" aria-disabled>
        {!trailing && <Icon name={icon} size={15} />}
        <span className="sr-only">{label}</span>
        {trailing && <Icon name={icon} size={15} />}
      </span>
    );
  }
  return (
    <Link href={href} className="btn btn-ghost btn-sm">
      {!trailing && <Icon name={icon} size={15} />}
      <span className="sr-only">{label}</span>
      {trailing && <Icon name={icon} size={15} />}
    </Link>
  );
}

function formatDate(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
