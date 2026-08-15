import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import NewOrderForm, { type Currency, type Prefill, type ServiceOption } from "@/components/orders/new-order-form";
import MassOrderForm from "@/components/orders/mass-order-form";
import OrderTabs from "@/components/orders/order-tabs";
import { Icon } from "@/components/icons";
import AccountCard from "@/components/orders/account-card";
import { displayMoney } from "@/lib/currency";
import { getSetting } from "@/lib/settings";
import { priceServices, resolveTier } from "@/lib/pricing";
import { LINK_RULES } from "@/lib/links";

export const metadata: Metadata = { title: "New order" };

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
    db.platform.findMany({ where: { visible: true }, orderBy: { position: "asc" } }),
    db.category.findMany({ where: { visible: true }, orderBy: [{ position: "asc" }, { name: "asc" }] }),
    db.service.findMany({
      where: { enabled: true },
      orderBy: [{ position: "asc" }, { rate: "asc" }],
      // The platform's example link, so the form can show the shape wanted
      // before the order is refused for not having it.
      include: { category: { select: { platform: { select: LINK_RULES } } } },
    }),
  ]);

  const tier = await resolveTier(user);
  const rates = await priceServices(tier, services);

  const serviceOptions: ServiceOption[] = services.map((s) => ({
    id: s.id,
    publicId: s.publicId,
    name: s.name,
    categoryId: s.categoryId,
    linkExample:
      (s.target === "profile" ? s.category.platform?.profileExample : s.category.platform?.postExample) ?? "",
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
              prefill={prefill}
              labels={{
                platform: t("order.platform"),
                category: t("order.category"),
                service: t("order.service"),
                link: t("order.link"),
                quantity: t("order.quantity"),
                charge: t("order.charge"),
                submit: t("order.submit"),
                min: t("order.min"),
                max: t("order.max"),
                rate: t("order.rate"),
                comments: t("order.comments"),
                commentsHint: t("order.commentsHint"),
                username: t("order.username"),
                usernameHint: t("order.usernameHint"),
                posts: t("order.posts"),
                postsHint: t("order.postsHint"),
                perPost: t("order.perPost"),
                delay: t("order.delay"),
                delayHint: t("order.delayHint"),
                expiry: t("order.expiry"),
                expiryHint: t("order.expiryHint"),
                minutes: t("order.minutes"),
                balance: t("common.balance"),
                addFunds: t("dash.addFunds"),
                selectCategory: t("order.selectCategory"),
                selectService: t("order.selectService"),
                id: t("order.id"),
                limits: t("order.limits"),
                selectPlatform: t("order.selectPlatform"),
                quickFind: t("order.quickFind"),
                quickFindHint: t("order.quickFindHint"),
                quickFindPlaceholder: t("order.quickFindPlaceholder"),
                factStatus: t("order.factStatus"),
                factOn: t("order.factOn"),
                factTime: t("order.factTime"),
                factUnknown: t("order.factUnknown"),
                factCancel: t("order.factCancel"),
                factWarranty: t("order.factWarranty"),
                factYes: t("order.factYes"),
                factNo: t("order.factNo"),
                listPrice: t("order.listPrice"),
                selectPlatformFirst: t("order.selectPlatformFirst"),
                selectCategoryFirst: t("order.selectCategoryFirst"),
                searchService: t("common.search"),
                noResults: t("common.none"),
                averageTime: t("order.averageTime"),
                refillLabel: t("order.refill"),
                cancelLabel: t("order.cancel"),
                yes: t("common.yes"),
                no: t("common.no"),
                placed: t("order.placed"),
                track: t("order.track"),
                insufficient: t("order.insufficient"),
                dripfeed: t("order.dripfeed"),
                runs: t("order.runs"),
                interval: t("order.interval"),
                intervalHint: t("order.intervalHint"),
                total: t("order.totalQuantity"),
              }}
            />
          ),
          mass: (
            <MassOrderForm
              services={serviceOptions}
              balance={user.balance}
              currency={currency}
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
