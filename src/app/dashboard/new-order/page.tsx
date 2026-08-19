import { pageTitle } from "@/lib/page-title";
import { ON_SALE, SELLING_PLATFORM } from "@/lib/catalogue";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import NewOrderForm, { type Currency, type Prefill, type ServiceOption } from "@/components/orders/new-order-form";
import MassOrderForm from "@/components/orders/mass-order-form";
import OrderTabs from "@/components/orders/order-tabs";
import { Icon } from "@/components/icons";
import AccountCard from "@/components/orders/account-card";
import { displayMoney } from "@/lib/currency";
import { getSetting } from "@/lib/settings";
import { priceServices, resolvePricing } from "@/lib/pricing";
import { LINK_RULES } from "@/lib/links";
import { orderFormLabels } from "@/lib/order-form-labels";
import { toServiceOption } from "@/lib/service-option";
import { serviceStatsMany } from "@/lib/service-stats";

export const generateMetadata = pageTitle("dash.newOrder");

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const ctx = await getAppContext();
  const user = ctx.user!;
  const { t } = ctx;

  if (!(await getSetting("order.enabled"))) {
    return (
      <div className="alert alert-info mx-auto max-w-2xl" role="status">
        <Icon name="info" size={16} />
        <span>{t("order.disabled")}</span>
      </div>
    );
  }

  const [platforms, categories, services] = await Promise.all([
    db.platform.findMany({ where: SELLING_PLATFORM, orderBy: { position: "asc" } }),
    db.category.findMany({ where: { visible: true }, orderBy: [{ position: "asc" }, { name: "asc" }] }),
    db.service.findMany({
      where: ON_SALE,
      orderBy: [{ position: "asc" }, { rate: "asc" }],
      // The platform's example link, so the form can show the shape wanted
      // before the order is refused for not having it.
      include: { category: { select: { platform: { select: LINK_RULES } } } },
    }),
  ]);

  const scheduleMaxDays = Number(await getSetting("order.scheduleMaxDays")) || 0;
  const pricing = await resolvePricing(user);
  const tier = pricing.tier;
  const rates = await priceServices(pricing, services);

  // What each service actually did, from its own orders — one query for the
  // whole catalogue, not one per row.
  const measured = await serviceStatsMany(services.map((s) => s.id));

  const serviceOptions: ServiceOption[] = services.map((s) =>
    toServiceOption(s, {
      rate: rates.get(s.id),
      links: s.category.platform,
      stats: measured.get(s.id),
      t,
    }),
  );

  // "Order this again" arrives as a query string. The service travels as its
  // public number and is resolved here against the services actually on sale,
  // so a link to something since withdrawn opens an ordinary empty form rather
  // than a form pointing at a service the customer cannot buy.
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  // Numbers come back as digits or as nothing: the form feeds these straight
  // into number inputs, and the action revalidates every one of them anyway.
  const digits = (key: string) => (/^\d+$/.test(one(key)) ? one(key) : "");

  const wanted = Number(one("service"));
  const repeat = Number.isInteger(wanted) && wanted > 0 ? serviceOptions.find((s) => s.publicId === wanted) : undefined;

  const prefill: Prefill | undefined = repeat && {
    serviceId: repeat.id,
    link: one("link"),
    quantity: digits("quantity"),
    comments: one("comments"),
    username: one("username"),
    posts: digits("posts"),
    minPerPost: digits("minPerPost"),
    maxPerPost: digits("maxPerPost"),
    delay: digits("delay"),
    expiry: /^\d{4}-\d{2}-\d{2}$/.test(one("expiry")) ? one("expiry") : "",
    runs: digits("runs"),
    interval: digits("interval"),
  };

  const deposited = await db.transaction.aggregate({
    where: { userId: user.id, type: "deposit", status: "completed" },
    _sum: { amount: true },
  });

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
    numberFormat: ctx.currency.numberFormat,
    rate: ctx.currency.rate,
    locale: ctx.locale,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <h2 className="text-2xl font-bold tracking-tight">{t("dash.newOrder")}</h2>

      <OrderTabs
        label={t("order.type")}
        tabs={[
          { key: "single", label: t("order.single"), icon: "cart" },
          { key: "mass", label: t("order.mass"), icon: "layers" },
        ]}
      >
        {{
          single: (
            <NewOrderForm
              accountCard={
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
              }
              platforms={platforms.map((p) => ({ id: p.id, name: p.name, icon: p.icon, image: p.image, color: p.color }))}
              categories={categories.map((c) => ({ id: c.id, name: c.name, platformId: c.platformId }))}
              services={serviceOptions}
              balance={user.balance}
              currency={currency}
              baseDecimals={ctx.baseCurrency.decimals}
              prefill={prefill}
              scheduleMaxDays={scheduleMaxDays}
              labels={orderFormLabels(t)}
            />
          ),
          mass: (
            <MassOrderForm
              services={serviceOptions}
              balance={user.balance}
              currency={currency}
              baseDecimals={ctx.baseCurrency.decimals}
              labels={{
                title: t("order.massTitle"),
                format: t("order.massFormat"),
                submit: t("order.massSubmit"),
                lines: t("order.massLines"),
                estimated: t("order.massEstimated"),
                balance: t("common.balance"),
                placed: t("order.massPlaced"),
                failed: t("order.massFailed"),
                line: t("order.massLine"),
              }}
            />
          ),
        }}
      </OrderTabs>
    </div>
  );
}
