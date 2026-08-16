import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { dateFormats } from "@/lib/dates";
import { displayMoney } from "@/lib/currency";
import UserManager from "@/components/admin/user-manager";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Users" };

const PAGE_SIZE = 30;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const ctx = await getAppContext();
  const { t, currency, locale, timezone } = ctx;
  const dates = dateFormats(locale, timezone);

  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);

  const where = q ? { OR: [{ username: { contains: q } }, { email: { contains: q } }] } : {};
  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.user.count({ where }),
  ]);

  const tiers = await db.userTier.findMany({ orderBy: [{ position: "asc" }, { minSpent: "asc" }] });
  // What the spend ladder would give a customer with no override, so the
  // "automatic" option can name the tier it resolves to.
  const autoTier = (spent: number) =>
    [...tiers].filter((x) => x.minSpent > 0 && x.minSpent <= spent).sort((a, b) => b.minSpent - a.minSpent)[0] ??
    tiers.find((x) => x.isDefault);

  const fmtDate = { format: dates.day };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{t("admin.users")}</h2>
        <span className="muted text-sm tabular-nums">{total}</span>
      </div>

      <form className="flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <span className="muted pointer-events-none absolute top-1/2 start-3.5 -translate-y-1/2">
            <Icon name="search" size={16} />
          </span>
          <label htmlFor="q" className="sr-only">
            {t("common.search")}
          </label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder={t("common.search")} className="field ps-11" />
        </div>
        <button type="submit" className="btn btn-ghost">
          <Icon name="filter" size={15} />
          {t("admin.filter")}
        </button>
      </form>

      <UserManager
        tiers={tiers.map((x) => ({ id: x.id, name: x.name }))}
        rows={users.map((u) => ({
          id: u.id,
          publicId: u.publicId,
          username: u.username,
          email: u.email,
          role: u.role,
          balance: displayMoney(u.balance, currency, locale),
          spent: displayMoney(u.spent, currency, locale),
          banned: u.banned,
          twoFactor: u.totpEnabledAt !== null,
          banReason: u.banReason,
          createdAt: fmtDate.format(u.createdAt),
          tierId: u.tierId ?? "",
          tierName: autoTier(u.spent)?.name ?? "",
        }))}
        labels={{
          close: t("common.close"),
          empty: t("common.none"),
          user: t("auth.username"),
          balance: t("admin.balance"),
          spent: t("admin.spent"),
          role: t("admin.role"),
          tier: t("tier.tier"),
          auto: t("tier.auto"),
          status: t("common.status"),
          actions: t("common.actions"),
          active: t("admin.active"),
          suspended: t("admin.suspended"),
          suspend: t("admin.suspend"),
          clear2fa: t("auth.2fa.clear"),
          confirmClear2fa: t("auth.2fa.clearConfirm"),
          unsuspend: t("admin.unsuspend"),
          reason: t("admin.reason"),
          adjustBalance: t("admin.adjustBalance"),
          adjustHint: t("admin.adjustHint"),
          amount: t("common.amount"),
          note: t("admin.note"),
          save: t("common.save"),
          cancel: t("common.cancel"),
        }}
      />
    </div>
  );
}
