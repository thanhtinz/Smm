import { pageTitle } from "@/lib/page-title";
import { getAppContext } from "@/lib/context";
import { getAvailableMethods } from "@/lib/payments";
import { getCurrentUser } from "@/lib/auth";
import { allowedMethods } from "@/lib/access";
import { getSetting } from "@/lib/settings";
import DepositForm from "@/components/wallet/deposit-form";

export const generateMetadata = pageTitle("dash.addFunds");

export default async function WalletPage() {
  const ctx = await getAppContext();
  const { t } = ctx;
  const [all, presets, user] = await Promise.all([
    getAvailableMethods(),
    // Quick-pick amounts are per-currency and live in settings, so an operator
    // can retune them without a deploy.
    getSetting("wallet.quickAmounts"),
    getCurrentUser(),
  ]);

  // An account restricted to one method is shown that one, not all of them
  // with the others failing on submit. Restricting every method away leaves
  // the form's own "no methods" notice, which is the honest thing to show.
  const methods = allowedMethods(user, all);

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
          numberFormat: c.numberFormat,
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
          coupon: t("wallet.coupon"),
          couponHint: t("wallet.couponHint"),
        }}
      />
    </div>
  );
}
