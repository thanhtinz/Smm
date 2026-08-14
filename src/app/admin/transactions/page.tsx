import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { dateFormats } from "@/lib/dates";
import { displayMoney } from "@/lib/currency";
import TransactionManager from "@/components/admin/transaction-manager";

export const metadata: Metadata = { title: "Transactions" };

const PAGE_SIZE = 30;

export default async function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const ctx = await getAppContext();
  const { t, currency, locale, timezone } = ctx;
  const dates = dateFormats(locale, timezone);

  const status = ["pending", "completed", "failed", "canceled"].includes(params.status ?? "")
    ? params.status
    : undefined;
  const page = Math.max(1, Number(params.page) || 1);

  const where = { type: "deposit", ...(status ? { status } : {}) };
  const [rows, total, pendingCount] = await Promise.all([
    db.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { username: true } }, method: { select: { name: true } } },
    }),
    db.transaction.count({ where }),
    db.transaction.count({ where: { type: "deposit", status: "pending" } }),
  ]);

  const fmtDate = { format: dates.stamp };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{t("wallet.history")}</h2>
        {pendingCount > 0 && <span className="badge badge-warning">{pendingCount}</span>}
      </div>

      <TransactionManager
        activeStatus={status ?? ""}
        page={page}
        totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
        rows={rows.map((r) => ({
          id: r.id,
          publicId: r.publicId,
          username: r.user.username,
          method: r.method?.name ?? "—",
          paid: `${r.paidAmount.toLocaleString()} ${r.currency}`,
          credited: displayMoney(r.amount, currency, locale),
          status: r.status,
          reference: r.reference,
          note: r.note,
          createdAt: fmtDate.format(r.createdAt),
        }))}
        labels={{
          close: t("common.close"),
          pagination: t("common.pagination"),
          empty: t("common.none"),
          id: t("order.id"),
          user: t("auth.username"),
          method: t("wallet.method"),
          paid: t("wallet.payable"),
          credited: t("wallet.credited"),
          status: t("common.status"),
          date: t("common.date"),
          actions: t("common.actions"),
          all: t("common.all"),
          approve: t("admin.approve"),
          reject: t("admin.reject"),
          confirmApprove: t("admin.confirmApprove"),
          reason: t("admin.reason"),
          "status.pending": t("status.pending"),
          "status.review": t("status.review"),
          "status.completed": t("status.completed"),
          "status.failed": t("status.failed"),
          "status.canceled": t("status.canceled"),
        }}
      />
    </div>
  );
}
