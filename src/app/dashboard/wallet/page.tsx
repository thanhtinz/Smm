import type { Metadata } from "next";
import { getAppContext } from "@/lib/context";
import { getAvailableMethods } from "@/lib/payments";
import { getSetting } from "@/lib/settings";
import DepositForm from "@/components/wallet/deposit-form";

export const metadata: Metadata = { title: "Add funds" };

export default async function WalletPage() {
  const ctx = await getAppContext();
  const { t } = ctx;
  const [methods, presets] = await Promise.all([
    getAvailableMethods(),
    // Quick-pick amounts are per-currency and live in settings, so an operator
    // can retune them without a deploy.
    getSetting("wallet.quickAmounts"),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <h2 className="text-2xl font-bold tracking-tight">{t("dash.addFunds")}</h2>

      <DepositForm
        methods={methods}
        currencies={ctx.currencies.map((c) => ({
          code: c.code,
          symbol: c.symbol,
          symbolBefore: c.symbolBefore,
          decimals: c.decimals,
        }))}
        presets={presets as Record<string, number[]>}
        locale={ctx.locale}
        labels={{
          method: t("wallet.method"),
          amount: t("wallet.amount"),
          currency: t("common.currency"),
          continue: t("wallet.continue"),
          fee: t("wallet.fee"),
          bonus: t("wallet.bonus"),
          payable: t("wallet.payable"),
          credited: t("wallet.credited"),
          unavailable: t("wallet.unavailable"),
          presets: t("wallet.presets"),
          noMethods: t("wallet.noMethods"),
        }}
      />
    </div>
  );
}
