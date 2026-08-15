import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { getSetting } from "@/lib/settings";
import { priceServices, resolveTier } from "@/lib/pricing";
import { displayMoney } from "@/lib/currency";
import { Icon } from "@/components/icons";
import PlatformMark from "@/components/platform-mark";
import NewOrderForm, { type Currency, type ServiceOption } from "@/components/orders/new-order-form";
import AccountCard from "@/components/orders/account-card";
import { OrderNotes, OrderSupport } from "@/components/orders/order-aside";
import { orderFormLabels } from "@/lib/order-form-labels";
import { LINK_RULES } from "@/lib/links";

export const metadata: Metadata = { title: "Order" };

/**
 * A category's order page, inside the panel.
 *
 * The sidebar is the platform and its categories, and this is what a category
 * opens onto: the form, already narrowed to that category, with everything a
 * buyer here checks before spending beside it. The two steps the cascade would
 * ask were answered by the click that got here, so the form starts at the one
 * that still matters — which service.
 *
 * Same form component the dashboard's own page renders, not a copy: one set of
 * limits, one price calculation, one balance check.
 */
export default async function PanelCategoryOrderPage({
  params,
}: {
  params: Promise<{ platform: string; category: string }>;
}) {
  const { platform: platformSlug, category: slug } = await params;
  const ctx = await getAppContext();
  const user = ctx.user!;
  const { t } = ctx;

  const category = await db.category.findFirst({
    where: { slug, visible: true, platform: { slug: platformSlug, visible: true } },
    include: {
      platform: { select: { ...LINK_RULES, id: true, slug: true, name: true, icon: true, image: true, color: true } },
      services: { where: { enabled: true }, orderBy: [{ position: "asc" }, { rate: "asc" }] },
    },
  });
  if (!category || !category.platform) notFound();
  const platform = category.platform;

  if (!(await getSetting("order.enabled"))) {
    return (
      <div className="alert alert-info mx-auto max-w-2xl" role="status">
        <Icon name="info" size={16} />
        <span>{t("order.disabled")}</span>
      </div>
    );
  }

  const tier = await resolveTier(user);
  const rates = await priceServices(tier, category.services);

  const serviceOptions: ServiceOption[] = category.services.map((s) => ({
    id: s.id,
    publicId: s.publicId,
    name: s.name,
    categoryId: s.categoryId,
    linkExample: (s.target === "profile" ? platform.profileExample : platform.postExample) ?? "",
    rate: rates.get(s.id) ?? s.rate,
    listRate: s.rate,
    min: s.min,
    max: s.max,
    refill: s.refill,
    cancel: s.cancel,
    dripfeed: s.dripfeed,
    type: s.type,
    averageTime: s.averageTime,
    description: s.description,
  }));

  const [deposited, notes] = await Promise.all([
    db.transaction.aggregate({
      where: { userId: user.id, type: "deposit", status: "completed" },
      _sum: { amount: true },
    }),
    getSetting("order.notes"),
  ]);

  const account = {
    name: user.fullName || user.username,
    balance: user.balance,
    deposited: deposited._sum.amount ?? 0,
    tierName: tier?.name ?? "",
    tierColor: tier?.color ?? "",
    discountPercent: tier?.discountPercent ?? 0,
  };

  const currency: Currency = {
    code: ctx.currency.code,
    symbol: ctx.currency.symbol,
    symbolBefore: ctx.currency.symbolBefore,
    decimals: ctx.currency.decimals,
    rate: ctx.currency.rate,
    locale: ctx.locale,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <PlatformMark platform={platform} size={20} box={40} />
        <h2 className="flex min-w-0 flex-wrap items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
          <span className="muted">{platform.name}</span>
          <Icon name="chevronRight" size={16} className="muted" />
          <span>{category.name}</span>
        </h2>
      </header>

      {category.description && <p className="muted max-w-3xl text-sm leading-relaxed">{category.description}</p>}

      <NewOrderForm
        accountCard={
          <>
            <AccountCard
              account={account}
              money={{
                balance: displayMoney(account.balance, ctx.currency, ctx.locale),
                deposited: displayMoney(account.deposited, ctx.currency, ctx.locale),
              }}
              labels={{
                balance: t("common.balance"),
                deposited: t("order.deposited"),
                tier: t("tier.title"),
                addFunds: t("dash.addFunds"),
                account: t("nav.profile"),
              }}
            />
            <OrderNotes notes={String(notes ?? "")} title={t("order.notesTitle")} />
            <OrderSupport settings={ctx.settings} title={t("order.supportTitle")} />
          </>
        }
        platforms={[{ id: platform.id, name: platform.name, icon: platform.icon, image: platform.image, color: platform.color }]}
        categories={[{ id: category.id, name: category.name, platformId: platform.id }]}
        services={serviceOptions}
        balance={user.balance}
        currency={currency}
        locked
        labels={orderFormLabels(t)}
      />
    </div>
  );
}
