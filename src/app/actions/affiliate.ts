"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/context";
import { formatMoney } from "@/lib/currency";
import { withdrawReferralEarnings } from "@/lib/affiliate";

export type WithdrawState = { error?: string; moved?: number };

export async function withdrawEarningsAction(): Promise<WithdrawState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session expired." };

  const result = await withdrawReferralEarnings(user.id);
  revalidatePath("/dashboard/affiliate");
  revalidatePath("/dashboard");
  if (!result.error) return { moved: result.moved };

  // Thresholds are held in the base currency, so they are shown in it too.
  const { t, baseCurrency, locale } = await getAppContext();
  const vars = result.error.vars
    ? Object.fromEntries(
        Object.entries(result.error.vars).map(([k, v]) => [k, formatMoney(v, baseCurrency, locale)]),
      )
    : undefined;
  return { error: t(result.error.key, vars) };
}
