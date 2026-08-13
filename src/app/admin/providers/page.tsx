import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import ProviderManager from "@/components/admin/provider-manager";

export const metadata: Metadata = { title: "Providers" };

export default async function AdminProvidersPage() {
  const ctx = await getAppContext();
  const { t, locale } = ctx;

  const providers = await db.provider.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { services: true } } },
  });

  const fmtDate = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : locale, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

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
        }))}
        labels={{
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
