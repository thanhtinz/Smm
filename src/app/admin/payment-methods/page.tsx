import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { drivers, isConfigured, parseConfig, parseCurrencies } from "@/lib/payments";
import { VIETQR_BANKS } from "@/lib/payments/vietqr";
import PaymentMethodManager from "@/components/admin/payment-method-manager";

export const metadata: Metadata = { title: "Payment methods" };

export default async function AdminPaymentMethodsPage() {
  const ctx = await getAppContext();
  const { t } = ctx;

  const methods = await db.paymentMethod.findMany({ orderBy: { position: "asc" } });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PaymentMethodManager
        currencyCodes={ctx.currencies.map((c) => c.code)}
        rows={methods.map((m) => {
          const config = parseConfig(m.config);
          const driver = drivers[m.driver];
          // Only whether a secret is set travels to the browser, never its value.
          const filled: Record<string, boolean> = {};
          for (const field of driver?.fields ?? []) filled[field.name] = Boolean(config[field.name]?.trim());

          return {
            id: m.id,
            code: m.code,
            name: m.name,
            driver: m.driver,
            icon: m.icon,
            description: m.description,
            enabled: m.enabled,
            configured: isConfigured(m.driver, config),
            currencies: parseCurrencies(m.currencies),
            minAmount: m.minAmount,
            maxAmount: m.maxAmount,
            feePercent: m.feePercent,
            feeFixed: m.feeFixed,
            bonusPercent: m.bonusPercent,
            position: m.position,
            filled,
            fields: (driver?.fields ?? []).map((f) => ({
              name: f.name,
              label: f.label,
              type: f.type,
              hint: f.hint,
              // The bank list is data, not a hard-coded form option.
              options: f.name === "bankCode" ? Object.keys(VIETQR_BANKS) : f.options,
            })),
          };
        })}
        labels={{
          title: t("admin.paymentMethods"),
          configure: t("admin.configure"),
          configured: t("admin.configured"),
          unconfigured: t("wallet.unavailable"),
          enabled: t("admin.enabled"),
          disabled: t("admin.disabled"),
          name: t("admin.name"),
          description: t("admin.description"),
          currencies: t("common.currency"),
          min: t("order.min"),
          max: t("order.max"),
          fee: t("wallet.fee"),
          bonus: t("wallet.bonus"),
          position: t("admin.position"),
          credentials: t("admin.credentials"),
          secretSet: t("admin.secretSet"),
          save: t("common.save"),
          cancel: t("common.cancel"),
        }}
      />
    </div>
  );
}
