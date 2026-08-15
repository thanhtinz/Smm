"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser, logActivity } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { nextPublicId } from "@/lib/ids";
import { getCurrencies, getBaseCurrency } from "@/lib/currency";
import { computeTotals, drivers, isConfigured, parseConfig, parseCurrencies } from "@/lib/payments";
import { evaluateCoupon, redeemCoupon } from "@/lib/coupons";
import { panelBaseUrl, getCurrentPanel } from "@/lib/tenancy";
import { readerText } from "@/lib/context";
import { formatCount } from "@/lib/numbers";

export type DepositState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function createDepositAction(_prev: DepositState, formData: FormData): Promise<DepositState> {
  const { t, locale } = await readerText();
  const user = await getCurrentUser();
  if (!user) return { error: t("err.session") };

  const methodId = String(formData.get("methodId") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const currencyCode = String(formData.get("currency") ?? "").trim();

  const method = await db.paymentMethod.findFirst({ where: { id: methodId, enabled: true } });
  if (!method) return { fieldErrors: { methodId: t("err.chooseMethod") } };

  const config = parseConfig(method.config);
  if (!isConfigured(method.driver, config)) {
    return { error: t("err.methodUnconfigured") };
  }

  const amount = Number(amountRaw);
  if (!amountRaw || !Number.isFinite(amount) || amount <= 0) {
    return { fieldErrors: { amount: t("err.amountRequired") } };
  }

  const accepted = parseCurrencies(method.currencies);
  const currencies = await getCurrencies();
  const currency = currencies.find((c) => c.code === currencyCode && (accepted.length === 0 || accepted.includes(c.code)));
  if (!currency) return { fieldErrors: { currency: t("err.currencyForMethod") } };

  if (method.minAmount > 0 && amount < method.minAmount) {
    return { fieldErrors: { amount: t("err.methodMin", { amount: formatCount(method.minAmount, locale), currency: currency.code }) } };
  }
  if (method.maxAmount > 0 && amount > method.maxAmount) {
    return { fieldErrors: { amount: t("err.methodMax", { amount: formatCount(method.maxAmount, locale), currency: currency.code }) } };
  }

  // The panel's own floor is expressed in the base currency.
  const base = await getBaseCurrency();
  const amountInBase = amount / (currency.rate || 1);
  const minDeposit = Number(await getSetting("wallet.minDeposit")) || 0;
  const maxDeposit = Number(await getSetting("wallet.maxDeposit")) || 0;
  if (minDeposit > 0 && amountInBase < minDeposit) {
    return { fieldErrors: { amount: t("err.depositMin", { amount: formatCount(minDeposit, locale), currency: base.code }) } };
  }
  if (maxDeposit > 0 && amountInBase > maxDeposit) {
    return { fieldErrors: { amount: t("err.depositMax", { amount: formatCount(maxDeposit, locale), currency: base.code }) } };
  }

  const totals = computeTotals(amount, method);

  // A coupon adds on top of the method's own bonus, and is validated against
  // the base-currency value so one code behaves the same in every currency.
  const couponCode = String(formData.get("coupon") ?? "").trim();
  let couponBonusBase = 0;
  let couponId = "";
  if (couponCode) {
    const check = await evaluateCoupon(couponCode, user.id, amountInBase, locale);
    if (!check.ok) return { fieldErrors: { coupon: t(check.key, check.vars) } };
    couponBonusBase = check.bonus;
    couponId = check.couponId;
  }

  const creditedBase = totals.credited / (currency.rate || 1) + couponBonusBase;

  const publicId = await nextPublicId("transaction");
  const transaction = await db.transaction.create({
    data: {
      publicId,
      userId: user.id,
      methodId: method.id,
      type: "deposit",
      amount: creditedBase,
      paidAmount: totals.payable,
      currency: currency.code,
      fee: totals.fee,
      status: "pending",
      note: method.name,
      meta: JSON.stringify({ requested: amount, bonus: totals.bonus, couponCode, couponBonusBase }),
    },
  });

  if (couponId) await redeemCoupon(couponId, user.id, transaction.id, couponBonusBase);

  await logActivity(user.id, "deposit.create", `#${publicId} ${totals.payable} ${currency.code} via ${method.code}`);
  redirect(`/dashboard/wallet/${transaction.id}`);
}

/**
 * Builds the gateway instruction for a pending deposit. Called from the
 * payment page rather than at creation time so a reload can retry a gateway
 * that was temporarily unreachable.
 */
export async function prepareDeposit(transactionId: string) {
  const user = await getCurrentUser();
  if (!user) return null;

  const txn = await db.transaction.findFirst({
    where: { id: transactionId, userId: user.id },
    include: { method: true },
  });
  if (!txn || !txn.method) return null;

  const driver = drivers[txn.method.driver];
  const config = parseConfig(txn.method.config);
  if (!driver) return { kind: "unconfigured" as const, key: "err.payDriver" };
  if (!isConfigured(txn.method.driver, config)) {
    return { kind: "unconfigured" as const, key: "err.payUnconfigured" };
  }

  const prefix = (config.prefix || "NOVA").replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "NOVA";
  const reference = `${prefix}${txn.publicId}`;

  try {
    // A wallet gateway calls back to a fixed URL, so the panel has to be named
    // in it — the same token the other webhook routes are addressed by.
    const panel = await getCurrentPanel();

    return await driver.prepare({
      amount: txn.paidAmount,
      currency: txn.currency,
      reference,
      transactionId: txn.id,
      publicId: txn.publicId,
      panelToken: panel?.webhookToken ?? "",
      config,
      appUrl: await panelBaseUrl(),
    });
  } catch {
    return { kind: "unconfigured" as const, key: "err.payUnreachable" };
  }
}

export async function cancelDepositAction(transactionId: string) {
  const user = await getCurrentUser();
  if (!user) return;
  await db.transaction.updateMany({
    where: { id: transactionId, userId: user.id, status: "pending", type: "deposit" },
    data: { status: "canceled" },
  });
  redirect("/dashboard/transactions");
}
