import type { Metadata } from "next";
import { getAppContext } from "@/lib/context";
import { getAvailableMethods } from "@/lib/payments";
import DepositForm from "@/components/wallet/deposit-form";

export const metadata: Metadata = { title: "Add funds" };

/** Quick-pick amounts, sized to each currency rather than converted. */
const PRESETS: Record<string, number[]> = {
  VND: [50_000, 100_000, 200_000, 500_000, 1_000_000],
  USD: [5, 10, 25, 50, 100],
  EUR: [5, 10, 25, 50, 100],
  TRY: [100, 250, 500, 1000],
  INR: [500, 1000, 2500, 5000],
};

export default async function WalletPage() {
  const ctx = await getAppContext();
  const { t } = ctx;
  const methods = await getAvailableMethods();

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
        presets={PRESETS}
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
