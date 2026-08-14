import { getAppContext } from "@/lib/context";
import { captchaFor } from "@/lib/captcha";
import { landingData, LANDING_LAYOUTS, type LandingLayout } from "@/lib/landing";
import PriceBoard from "@/components/landing/price-board";
import OrderFirst from "@/components/landing/order-first";
import Proof from "@/components/landing/proof";
import Editorial from "@/components/landing/editorial";
import Catalogue from "@/components/landing/catalogue";
import type { LayoutProps } from "@/components/landing/types";

/**
 * Five landings, chosen in admin.
 *
 * They are not reorderings of one page: each answers the visitor's first
 * question differently — with a price, with a working quote, with finished
 * orders, with an argument, or with the whole catalogue — so an operator
 * picks the opening that suits what they sell.
 */
const LAYOUTS: Record<LandingLayout, (props: LayoutProps) => React.ReactNode> = {
  priceBoard: PriceBoard,
  orderFirst: OrderFirst,
  proof: Proof,
  editorial: Editorial,
  catalogue: Catalogue,
};

export default async function LandingPage() {
  const ctx = await getAppContext();
  const { t, currency, locale, settings, user } = ctx;

  // The captcha is only fetched when a sign-in box is actually going on the
  // page — an operator who turned it off should not pay for the lookup.
  const wantsLogin = settings["landing.heroLogin"] !== false && !user;
  const [data, captcha] = await Promise.all([landingData(user), wantsLogin ? captchaFor("login") : null]);

  const chosen = String(settings["appearance.landingLayout"] ?? "");
  const layout = (LANDING_LAYOUTS as readonly string[]).includes(chosen)
    ? (chosen as LandingLayout)
    : LANDING_LAYOUTS[0];
  const Layout = LAYOUTS[layout];

  return (
    <Layout
      data={data}
      t={t}
      currency={currency}
      locale={locale}
      settings={settings}
      captcha={captcha}
      signedIn={Boolean(user)}
      loginLabels={{
        username: t("auth.username"),
        password: t("auth.password"),
        remember: t("auth.remember"),
        forgot: t("auth.forgot"),
        submit: t("nav.signin"),
        noaccount: t("auth.noaccount"),
        signup: t("nav.signup"),
      }}
    />
  );
}
