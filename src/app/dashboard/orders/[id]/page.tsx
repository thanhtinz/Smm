import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { dateFormats, formatDuration } from "@/lib/dates";
import { displayMoney } from "@/lib/currency";
import { Icon } from "@/components/icons";
import StatusBadge from "@/components/ui/status-badge";
import OrderActions from "@/components/orders/order-actions";

export const metadata: Metadata = { title: "Order" };

/**
 * One order, in full.
 *
 * The list has room for a row; everything the panel learns from the provider
 * after that — how much has actually landed, where a refill got to — was being
 * written and never shown, so a customer asking "is it working?" had to open a
 * ticket to find out something the panel already knew.
 */
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAppContext();
  const user = ctx.user!;
  const { t, currency, locale, timezone } = ctx;
  const dates = dateFormats(locale, timezone);

  const publicId = Number(id.replace(/^#/, ""));
  if (!Number.isInteger(publicId)) notFound();

  const order = await db.order.findFirst({
    where: { publicId, userId: user.id },
    include: {
      service: { select: { name: true, refill: true, cancel: true, description: true } },
      requests: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!order) notFound();

  // remains only means anything once a provider has reported on the order.
  // Zero on something still queued is "nothing known", not "all delivered",
  // and showing a full bar there would be a lie the panel tells first.
  const reported = order.status !== "pending" && (order.remains > 0 || order.status === "completed");
  const delivered = order.status === "completed" ? order.quantity : Math.max(0, order.quantity - order.remains);
  const percent = reported && order.quantity > 0 ? Math.min(100, Math.round((delivered / order.quantity) * 100)) : null;

  const took =
    order.settledAt !== null
      ? formatDuration(Math.round((order.settledAt.getTime() - order.createdAt.getTime()) / 1000), t)
      : null;

  const facts: { label: string; value: string }[] = [
    { label: t("order.quantity"), value: order.quantity.toLocaleString() },
    { label: t("order.charge"), value: displayMoney(order.charge, currency, locale) },
    { label: t("common.date"), value: dates.full(order.createdAt) },
    ...(order.settledAt ? [{ label: t("order.finished"), value: dates.full(order.settledAt) }] : []),
    ...(took ? [{ label: t("order.took"), value: took }] : []),
    ...(reported ? [{ label: t("order.startCount"), value: order.startCount.toLocaleString() }] : []),
    ...(order.runs ? [{ label: t("order.runs"), value: `${order.runs} × ${order.interval} ${t("order.minutes")}` }] : []),
    ...(order.posts
      ? [
          { label: t("order.posts"), value: String(order.posts) },
          { label: t("order.perPost"), value: `${order.minPerPost}–${order.maxPerPost}` },
          ...(order.delay ? [{ label: t("order.delay"), value: `${order.delay} ${t("order.minutes")}` }] : []),
          ...(order.expiry ? [{ label: t("order.expiry"), value: dates.day(order.expiry) }] : []),
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/dashboard/orders" className="btn btn-ghost btn-sm">
        <Icon name="arrowLeft" size={15} />
        {t("dash.orders")}
      </Link>

      <section className="card card-pad space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="muted font-mono text-xs">#{order.publicId}</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight">{order.service.name}</h2>
          </div>
          <StatusBadge status={order.status} label={t(`status.${order.status}`)} />
        </div>

        {percent !== null && (
          <div>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="muted">{t("order.delivered")}</span>
              <span className="font-semibold tabular-nums">
                {delivered.toLocaleString()} / {order.quantity.toLocaleString()}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface2)]">
              <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${percent}%` }} />
            </div>
          </div>
        )}

        <div>
          <span className="muted text-xs">{t("order.link")}</span>
          {order.posts ? (
            <p className="mt-0.5 font-medium">@{order.link}</p>
          ) : (
            <a
              href={order.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 flex items-center gap-1.5 font-medium break-all hover:text-[var(--primary)]"
            >
              {order.link}
              <Icon name="external" size={14} />
            </a>
          )}
        </div>

        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {facts.map((f) => (
            <div key={f.label} className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] pb-2">
              <dt className="muted text-sm">{f.label}</dt>
              <dd className="text-sm font-medium tabular-nums">{f.value}</dd>
            </div>
          ))}
        </dl>

        {order.comments && (
          <div>
            <span className="muted text-xs">{t("order.comments")}</span>
            <pre className="surface-2 mt-1 max-h-60 overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
              {order.comments}
            </pre>
          </div>
        )}

        {/* Order.note carries provider names and their refusal text, which is
            the panel's supply chain rather than the customer's business, so it
            is left to the admin screens. */}

        <div className="flex justify-end">
          <OrderActions
            order={{
              orderId: order.id,
              canRefill: order.service.refill && ["completed", "partial"].includes(order.status),
              canCancel: order.service.cancel && ["pending", "processing"].includes(order.status),
              openRequest: order.requests.find((r) => ["pending", "approved"].includes(r.status))?.type ?? null,
            }}
            labels={{
              refill: t("order.refill"),
              cancel: t("order.cancel"),
              refillPending: t("order.refillPending"),
              cancelPending: t("order.cancelPending"),
            }}
          />
        </div>
      </section>

      {order.requests.length > 0 && (
        <section className="card overflow-hidden">
          <header className="px-5 py-4">
            <h3 className="font-semibold">{t("order.requestHistory")}</h3>
          </header>
          <ul className="divide-y divide-[var(--border)]">
            {order.requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {r.type === "refill" ? t("order.refill") : t("order.cancel")}
                    <span className="muted ml-2 font-mono text-xs">#{r.publicId}</span>
                  </p>
                  {/* The operator's own note, written to be read by whoever
                      raised the request. */}
                  {r.note && <p className="muted mt-1 text-sm">{r.note}</p>}
                  <p className="muted mt-1 text-xs">{dates.full(r.createdAt)}</p>
                </div>
                <span className="badge badge-muted">{t(`request.status.${r.status}`)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
