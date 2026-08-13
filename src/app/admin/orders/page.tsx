import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { displayMoney } from "@/lib/currency";
import { ORDER_STATUSES } from "@/lib/orders";
import OrderManager from "@/components/admin/order-manager";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Orders" };

const PAGE_SIZE = 30;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const ctx = await getAppContext();
  const { t, currency, locale } = ctx;

  const status = ORDER_STATUSES.includes(params.status as never) ? params.status : undefined;
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);

  const where = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { link: { contains: q } },
            { service: { name: { contains: q } } },
            { user: { username: { contains: q } } },
          ],
        }
      : {}),
  };

  const [orders, total, counts] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { service: { select: { name: true } }, user: { select: { username: true } } },
    }),
    db.order.count({ where }),
    db.order.groupBy({ by: ["status"], _count: true }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const fmtDate = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : locale, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  // An expiry is a day, so it is shown without a clock and with its year.
  const fmtDay = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : locale, { dateStyle: "medium" });

  const labels: Record<string, string> = {
    empty: t("common.none"),
    id: t("order.id"),
    user: t("auth.username"),
    service: t("order.service"),
    quantity: t("order.quantity"),
    charge: t("order.charge"),
    status: t("common.status"),
    date: t("common.date"),
    confirmRefund: t("admin.confirmRefund"),
    edit: t("admin.edit"),
    save: t("common.save"),
    link: t("order.link"),
    startCount: t("order.startCount"),
    remains: t("order.remains"),
    providerOrderId: t("order.providerOrderId"),
    note: t("admin.note"),
    comments: t("order.comments"),
    username: t("order.username"),
    posts: t("order.posts"),
    perPost: t("order.perPost"),
    delay: t("order.delay"),
    expiry: t("order.expiry"),
    minutes: t("order.minutes"),
    source: t("order.source"),
    fromChild: t("order.fromChild"),
  };
  for (const s of ORDER_STATUSES) labels[`status.${s}`] = t(`status.${s}`);
  // The drawer shows the charge, and conversion belongs on the server.
  for (const o of orders) labels[`money.${o.id}`] = displayMoney(o.charge, currency, locale);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <h2 className="text-2xl font-bold tracking-tight">{t("dash.orders")}</h2>

      <form className="flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <span className="muted pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2">
            <Icon name="search" size={16} />
          </span>
          <label htmlFor="q" className="sr-only">
            {t("common.search")}
          </label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder={t("common.search")} className="field pl-11" />
        </div>
        <button type="submit" className="btn btn-ghost">
          <Icon name="filter" size={15} />
          {t("admin.filter")}
        </button>
      </form>

      <div className="scroll-x -mx-1 px-1">
        <div className="flex gap-2 pb-1">
          <Tab href="/admin/orders" active={!status} label={t("common.all")} count={counts.reduce((n, c) => n + c._count, 0)} />
          {ORDER_STATUSES.map((s) => (
            <Tab
              key={s}
              href={`/admin/orders?status=${s}`}
              active={status === s}
              label={t(`status.${s}`)}
              count={counts.find((c) => c.status === s)?._count ?? 0}
            />
          ))}
        </div>
      </div>

      <OrderManager
        rows={orders.map((o) => ({
          id: o.id,
          publicId: o.publicId,
          username: o.user.username,
          serviceName: o.service.name,
          link: o.link,
          quantity: o.quantity,
          charge: o.charge,
          status: o.status,
          createdAt: fmtDate.format(o.createdAt),
          startCount: o.startCount,
          remains: o.remains,
          providerOrderId: o.providerOrderId,
          note: o.note,
          comments: o.comments,
          subscription: o.posts
            ? {
                posts: o.posts,
                minPerPost: o.minPerPost ?? 0,
                maxPerPost: o.maxPerPost ?? 0,
                delay: o.delay ?? 0,
                expiry: o.expiry ? fmtDay.format(o.expiry) : "",
              }
            : null,
          fromChild: Boolean(o.sourceOrderId),
        }))}
        money={Object.fromEntries(orders.map((o) => [o.id, displayMoney(o.charge, currency, locale)]))}
        labels={labels}
      />

      {totalPages > 1 && (
        <nav className="flex items-center justify-between" aria-label="Pagination">
          <PageLink href={buildPage(status, q, page - 1)} disabled={page <= 1} icon="chevronLeft" />
          <span className="muted text-sm tabular-nums">
            {page} / {totalPages}
          </span>
          <PageLink href={buildPage(status, q, page + 1)} disabled={page >= totalPages} icon="chevronRight" />
        </nav>
      )}
    </div>
  );
}

function buildPage(status: string | undefined, q: string, page: number) {
  const sp = new URLSearchParams();
  if (status) sp.set("status", status);
  if (q) sp.set("q", q);
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `/admin/orders?${qs}` : "/admin/orders";
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
