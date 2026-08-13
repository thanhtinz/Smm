import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import CurrencyManager from "@/components/admin/currency-manager";

export const metadata: Metadata = { title: "Currencies" };

export default async function AdminCurrenciesPage() {
  const { t } = await getAppContext();
  const currencies = await db.currency.findMany({ orderBy: [{ position: "asc" }, { code: "asc" }] });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <CurrencyManager
        rows={currencies}
        labels={{
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
          rate: t("admin.rate"),
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
