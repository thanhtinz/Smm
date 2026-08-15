import type { Metadata } from "next";
import { getAppContext } from "@/lib/context";
import { captchaFor } from "@/lib/captcha";
import { landingData, chosenLayout, type LandingLayout } from "@/lib/landing";
import PriceBoard from "@/components/landing/price-board";
import OrderFirst from "@/components/landing/order-first";
import Proof from "@/components/landing/proof";
import Editorial from "@/components/landing/editorial";
import Catalogue from "@/components/landing/catalogue";
import Spotlight from "@/components/landing/spotlight";
import Grid from "@/components/landing/grid";
import Showcase from "@/components/landing/showcase";
import Midnight from "@/components/landing/midnight";
import type { LayoutProps } from "@/components/landing/types";

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: { canonical: "/" } };
}

/**
 * Nine landings, chosen in admin.
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
  spotlight: Spotlight,
  grid: Grid,
  showcase: Showcase,
  midnight: Midnight,
};

export default async function LandingPage() {
  const ctx = await getAppContext();
  const { t, currency, locale, settings, user } = ctx;

  // The captcha is only fetched when a sign-in box is actually going on the
  // page — an operator who turned it off should not pay for the lookup.
  const wantsLogin = settings["landing.heroLogin"] !== false && !user;
  const [data, captcha] = await Promise.all([landingData(user), wantsLogin ? captchaFor("login") : null]);

  const Layout = LAYOUTS[chosenLayout(settings)];

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
