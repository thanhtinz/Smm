import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { convert, displayMoney } from "@/lib/currency";
import { formatRate } from "@/lib/money";
import { resolvePricing, priceServices } from "@/lib/pricing";
import { ACCESS_RULES, parseAccessRules, parseAllowedMethods } from "@/lib/access";
import UserAccessPanel from "@/components/admin/user-access-panel";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Customer" };

/**
 * One customer, at the level of detail the list cannot carry: what they pay
 * for each service, what they may do, and which ways they may pay.
 *
 * A page rather than a drawer on the list because the rate card is the whole
 * catalogue — a panel with three hundred services does not fit in a panel that
 * slides over one.
 */
export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, currency, locale } = await getAppContext();

  const user = await db.user.findUnique({ where: { id }, include: { tier: true } });
  if (!user) notFound();

  const [services, overrides, methods] = await Promise.all([
    db.service.findMany({
      where: { deletedAt: null },
      orderBy: [{ position: "asc" }, { publicId: "asc" }],
      include: { category: { select: { name: true } } },
    }),
    db.userServiceRate.findMany({ where: { userId: id }, select: { serviceId: true, rate: true } }),
    db.paymentMethod.findMany({ orderBy: { position: "asc" } }),
  ]);

  // What this customer is charged today, override and all — the number to
  // compare an override against is the one they would otherwise pay, not the
  // list price.
  const pricing = await resolvePricing(user);
  const effective = await priceServices(pricing, services);

  // And what they would pay with the override lifted, so the editor can show
  // both and an operator can see what the deal is actually worth.
  const withoutOverride = await priceServices({ ...pricing, userId: null }, services);

  const overrideBy = new Map(overrides.map((row) => [row.serviceId, row.rate]));
  const denied = parseAccessRules(user.accessRules);
  const allowed = parseAllowedMethods(user.allowedPaymentMethods);

  // Rates are quoted per 1,000 like everywhere else in the panel, and in the
  // reader's currency, so `formatRate` rather than `displayMoney`.
  const rate = (value: number) => formatRate(convert(value, currency), currency);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/users" className="btn btn-ghost btn-sm mb-2">
            <Icon name="arrowLeft" size={14} />
            {t("admin.users")}
          </Link>
          <h2 className="text-2xl font-bold tracking-tight">{user.username}</h2>
          <p className="muted text-sm">{user.email}</p>
        </div>
        <dl className="flex gap-6 text-sm">
          <div>
            <dt className="muted">{t("admin.balance")}</dt>
            <dd className="font-semibold tabular-nums">{displayMoney(user.balance, currency, locale)}</dd>
          </div>
          <div>
            <dt className="muted">{t("admin.spent")}</dt>
            <dd className="font-semibold tabular-nums">{displayMoney(user.spent, currency, locale)}</dd>
          </div>
          <div>
            <dt className="muted">{t("tier.tier")}</dt>
            <dd className="font-semibold">{pricing.tier?.name ?? t("common.none")}</dd>
          </div>
        </dl>
      </div>

      <UserAccessPanel
        userId={user.id}
        discountPercent={user.discountPercent}
        tierName={pricing.tier?.name ?? ""}
        tierDiscount={pricing.tier?.discountPercent ?? 0}
        rules={ACCESS_RULES.map((rule) => ({
          rule,
          label: t(`access.rule.${rule}`),
          denied: denied.has(rule),
        }))}
        methods={methods.map((m) => ({
          id: m.id,
          name: m.name,
          enabled: m.enabled,
          // No list at all means every method, which is what an untouched
          // account has: the boxes start ticked rather than empty.
          allowed: allowed === null || allowed.has(m.id),
        }))}
        restricted={allowed !== null}
        services={services.map((s) => ({
          id: s.id,
          publicId: s.publicId,
          name: s.name,
          category: s.category.name,
          list: rate(s.rate),
          tier: rate(withoutOverride.get(s.id) ?? s.rate),
          effective: rate(effective.get(s.id) ?? s.rate),
          override: overrideBy.has(s.id) ? String(overrideBy.get(s.id)) : "",
        }))}
        labels={{
          pricing: t("access.pricing"),
          discount: t("access.userDiscount"),
          discountHint: t("access.userDiscountHint"),
          tierGives: t("access.tierGives"),
          rules: t("access.rules"),
          rulesHint: t("access.rulesHint"),
          methods: t("access.methods"),
          methodsHint: t("access.methodsHint"),
          allMethods: t("access.allMethods"),
          rateCard: t("access.rateCard"),
          rateCardHint: t("access.rateCardHint"),
          overrideCount: t("access.overrideCount"),
          resetRates: t("access.resetRates"),
          confirmReset: t("access.confirmReset"),
          copyTo: t("access.copyTo"),
          copyHint: t("access.copyHint"),
          copy: t("access.copy"),
          service: t("admin.services"),
          list: t("service.rate"),
          tierPrice: t("tier.tier"),
          effective: t("access.effective"),
          override: t("access.override"),
          clear: t("common.clear"),
          search: t("common.search"),
          save: t("common.save"),
          disabled: t("admin.disabled"),
        }}
      />
    </div>
  );
}
