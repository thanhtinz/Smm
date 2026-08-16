import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { dateFormats } from "@/lib/dates";
import CurrencyManager from "@/components/admin/currency-manager";
import { getSetting } from "@/lib/settings";

export const metadata: Metadata = { title: "Currencies" };

export default async function AdminCurrenciesPage() {
  const { t, locale, timezone } = await getAppContext();
  const dates = dateFormats(locale, timezone);
  const [currencies, autoUpdate] = await Promise.all([
    db.currency.findMany({ orderBy: [{ position: "asc" }, { code: "asc" }] }),
    getSetting("currency.autoUpdate"),
  ]);

  const fmtWhen = { format: dates.stamp };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <CurrencyManager
        autoUpdate={Boolean(autoUpdate)}
        rows={currencies.map((c) => ({
          ...c,
          rateUpdatedAt: c.rateUpdatedAt ? fmtWhen.format(c.rateUpdatedAt) : "",
        }))}
        labels={{
          close: t("common.close"),
          egName: t("eg.currencyName"),
          title: t("common.currency"),
          new: t("admin.new"),
          edit: t("admin.edit"),
          delete: t("admin.delete"),
          confirmDelete: t("admin.confirmDelete"),
          code: t("admin.code"),
          name: t("admin.name"),
          symbol: t("admin.symbol"),
          symbolBefore: t("admin.symbolBefore"),
          decimals: t("admin.decimals"),
          numberFormat: t("admin.numberFormat"),
          numberFormatHint: t("admin.numberFormatHint"),
          rate: t("currency.rate"),
          autoRate: t("currency.autoRate"),
          autoOn: t("currency.autoOn"),
          autoPinned: t("currency.autoPinned"),
          autoOff: t("currency.autoOff"),
          refreshRates: t("currency.refresh"),
          rateHint: t("admin.rateHint"),
          base: t("admin.base"),
          setBase: t("admin.setBase"),
          position: t("admin.position"),
          enabled: t("admin.enabled"),
          disabled: t("admin.disabled"),
          status: t("common.status"),
          actions: t("common.actions"),
          save: t("common.save"),
          cancel: t("common.cancel"),
        }}
      />
    </div>
  );
}
