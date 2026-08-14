import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { dateFormats } from "@/lib/dates";
import ProviderManager from "@/components/admin/provider-manager";

export const metadata: Metadata = { title: "Providers" };

export default async function AdminProvidersPage() {
  const ctx = await getAppContext();
  const { t, locale, timezone } = ctx;
  const dates = dateFormats(locale, timezone);

  const providers = await db.provider.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { services: true } } },
  });

  const fmtDate = { format: dates.stamp };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <ProviderManager
        rows={providers.map((p) => ({
          id: p.id,
          name: p.name,
          apiUrl: p.apiUrl,
          currency: p.currency,
          balance: p.balance,
          enabled: p.enabled,
          serviceCount: p._count.services,
          lastSyncAt: p.lastSyncAt ? fmtDate.format(p.lastSyncAt) : "",
          autoSync: p.autoSync,
          syncEveryHours: p.syncEveryHours,
          markupPercent: p.markupPercent,
          alertPercent: p.alertPercent,
          lowBalance: p.lowBalance,
        }))}
        labels={{
          close: t("common.close"),
          egName: t("eg.providerName"),
          title: t("admin.providers"),
          new: t("admin.new"),
          edit: t("admin.edit"),
          confirmDelete: t("admin.confirmDelete"),
          empty: t("provider.empty"),
          name: t("admin.name"),
          apiUrl: t("provider.apiUrl"),
          apiKey: t("provider.apiKey"),
          secretSet: t("admin.secretSet"),
          currency: t("common.currency"),
          balance: t("common.balance"),
          services: t("admin.services"),
          lastSync: t("provider.lastSync"),
          checkBalance: t("provider.checkBalance"),
          import: t("provider.import"),
          dispatch: t("provider.dispatch"),
          syncStatuses: t("provider.syncStatuses"),
          markup: t("provider.markup"),
          markupHint: t("provider.markupHint"),
          syncPrices: t("provider.syncPrices"),
          syncEvery: t("provider.syncEvery"),
          syncEveryHint: t("provider.syncEveryHint"),
          autoSync: t("provider.autoSync"),
          autoSyncOn: t("provider.autoSyncOn"),
          autoSyncEvery: t("provider.autoSyncEvery"),
          alert: t("provider.priceAlert"),
          alertHint: t("provider.priceAlertHint"),
          lowBalance: t("provider.lowBalance"),
          lowBalanceHint: t("provider.lowBalanceHint"),
          off: t("admin.disabled"),
          done: t("admin.saved"),
          enabled: t("admin.enabled"),
          disabled: t("admin.disabled"),
          save: t("common.save"),
          cancel: t("common.cancel"),
        }}
      />
    </div>
  );
}
