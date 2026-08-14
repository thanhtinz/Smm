import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { dateFormats } from "@/lib/dates";
import { getSetting } from "@/lib/settings";
import { displayMoney } from "@/lib/currency";
import { ensureReferralCode } from "@/lib/affiliate";
import { panelBaseUrl } from "@/lib/tenancy";
import CopyField from "@/components/ui/copy-field";
import StatCard from "@/components/ui/stat-card";
import WithdrawButton from "@/components/affiliate/withdraw-button";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Affiliate" };

export default async function AffiliatePage() {
  const ctx = await getAppContext();
  const user = ctx.user!;
  const { t, currency, locale, timezone } = ctx;
  const dates = dateFormats(locale, timezone);

  const [enabled, percent, minWithdraw] = await Promise.all([
    getSetting("affiliate.enabled"),
    getSetting("affiliate.commissionPercent"),
    getSetting("affiliate.minWithdraw"),
  ]);

  if (!enabled) {
    return (
      <div className="alert alert-info mx-auto max-w-2xl" role="status">
        <Icon name="info" size={16} />
        <span>{t("affiliate.disabled")}</span>
      </div>
    );
  }

  const code = await ensureReferralCode(user.id);
  const link = `${await panelBaseUrl()}/register?ref=${code}`;

  const [referrals, earnings] = await Promise.all([
    db.user.count({ where: { referredById: user.id } }),
    db.referralEarning.findMany({
      where: { referrerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { referred: { select: { username: true } } },
    }),
  ]);

  const available = earnings.filter((e) => e.status === "earned").reduce((n, e) => n + e.amount, 0);
  const lifetime = earnings.reduce((n, e) => n + e.amount, 0);

  const fmtDate = { format: dates.stamp };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <h2 className="text-2xl font-bold tracking-tight">{t("affiliate.title")}</h2>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t("affiliate.rate")} value={`${percent}%`} icon="trending" />
        <StatCard label={t("affiliate.referrals")} value={String(referrals)} icon="users" tone="accent" />
        <StatCard label={t("affiliate.available")} value={displayMoney(available, currency, locale)} icon="wallet" tone="success" />
        <StatCard label={t("affiliate.lifetime")} value={displayMoney(lifetime, currency, locale)} icon="chart" tone="warning" />
      </div>

      <div className="card card-pad space-y-3">
        <CopyField
          label={t("affiliate.code")}
          value={code}
          copyLabel={t("wallet.copy")}
          copiedLabel={t("wallet.copied")}
          mono
        />
        <CopyField
          label={t("affiliate.link")}
          value={link}
          copyLabel={t("wallet.copy")}
          copiedLabel={t("wallet.copied")}
          mono
          highlight
        />
        <div>
          <WithdrawButton label={t("affiliate.withdraw")} disabled={available <= 0} />
          <p className="form-hint">
            {t("affiliate.minWithdraw")}: {displayMoney(Number(minWithdraw), currency, locale)}
          </p>
        </div>
      </div>

      <div className="card overflow-hidden">
        {earnings.length === 0 ? (
          <p className="muted px-5 py-12 text-center text-sm">{t("common.none")}</p>
        ) : (
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("auth.username")}</th>
                  <th className="w-28 text-right">{t("common.amount")}</th>
                  <th className="w-24 text-right">{t("affiliate.rate")}</th>
                  <th className="w-32">{t("common.status")}</th>
                  <th className="w-36">{t("common.date")}</th>
                </tr>
              </thead>
              <tbody>
                {earnings.map((e) => (
                  <tr key={e.id}>
                    <td>{e.referred.username}</td>
                    <td className="text-right font-semibold tabular-nums text-[var(--success)]">
                      +{displayMoney(e.amount, currency, locale)}
                    </td>
                    <td className="muted text-right tabular-nums">{e.ratePercent}%</td>
                    <td>
                      <span className={`badge ${e.status === "earned" ? "badge-info" : "badge-muted"}`}>
                        {t(`affiliate.status.${e.status}`)}
                      </span>
                    </td>
                    <td className="muted text-xs">{fmtDate.format(e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
