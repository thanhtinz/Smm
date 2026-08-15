import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { dateFormats } from "@/lib/dates";
import { displayMoney } from "@/lib/currency";
import RequestManager from "@/components/admin/request-manager";
import { AUTO_CANCEL_NOTE } from "@/lib/requests";

export const metadata: Metadata = { title: "Requests" };

const STATUSES = ["pending", "approved", "rejected", "completed"];

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const ctx = await getAppContext();
  const { t, currency, locale, timezone } = ctx;
  const dates = dateFormats(locale, timezone);

  const status = STATUSES.includes(params.status ?? "") ? params.status : undefined;
  const [rows, counts] = await Promise.all([
    db.orderRequest.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { username: true } },
        order: { include: { service: { select: { name: true } } } },
      },
    }),
    db.orderRequest.groupBy({ by: ["status"], _count: true }),
  ]);

  const fmtDate = { format: dates.stamp };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <h2 className="text-2xl font-bold tracking-tight">{t("request.title")}</h2>

      <div className="scroll-x -mx-1 px-1">
        <div className="flex gap-2 pb-1">
          <Tab href="/admin/requests" active={!status} label={t("common.all")} count={counts.reduce((n, c) => n + c._count, 0)} />
          {STATUSES.map((s) => (
            <Tab
              key={s}
              href={`/admin/requests?status=${s}`}
              active={status === s}
              label={t(`request.status.${s}`)}
              count={counts.find((c) => c.status === s)?._count ?? 0}
            />
          ))}
        </div>
      </div>

      <RequestManager
        rows={rows.map((r) => ({
          id: r.id,
          publicId: r.publicId,
          type: r.type,
          status: r.status,
          username: r.user.username,
          orderPublicId: r.order.publicId,
          serviceName: r.order.service.name,
          link: r.order.link,
          charge: displayMoney(r.order.charge, currency, locale),
          // The panel's own note travels as a key; an operator's is prose.
          note: r.note === AUTO_CANCEL_NOTE ? t(r.note) : r.note,
          createdAt: fmtDate.format(r.createdAt),
        }))}
        labels={{
          close: t("common.close"),
          empty: t("common.none"),
          type: t("admin.type"),
          user: t("auth.username"),
          order: t("dash.orders"),
          charge: t("order.charge"),
          status: t("common.status"),
          actions: t("common.actions"),
          refill: t("order.refill"),
          cancel: t("order.cancel"),
          approve: t("admin.approve"),
          reject: t("admin.reject"),
          complete: t("request.complete"),
          reason: t("admin.reason"),
          confirmRefund: t("admin.confirmRefund"),
          "decision.pending": t("request.status.pending"),
          "decision.approved": t("request.status.approved"),
          "decision.rejected": t("request.status.rejected"),
          "decision.completed": t("request.status.completed"),
        }}
      />
    </div>
  );
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
