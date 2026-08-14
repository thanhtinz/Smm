import type { CurrencyInfo } from "@/lib/currency";
import type { LandingData } from "@/lib/landing";
import type { CaptchaProps } from "@/components/auth/captcha-field";
import type { HeroLoginLabels } from "./hero-login";

/**
 * What every landing layout is handed.
 *
 * The layouts differ in structure, not in data: each gets the same figures
 * and the same translator, and decides what deserves the top of the page.
 */
export type LandingProps = {
  data: LandingData;
  t: (key: string, vars?: Record<string, string | number>) => string;
  currency: CurrencyInfo;
  locale: string;
  settings: Record<string, unknown>;
};

/** What the layouts that open with the hero need on top of the above. */
export type HeroExtras = {
  /** Null when captcha is off or unconfigured, same as the sign-in page. */
  captcha: CaptchaProps | null;
  loginLabels: HeroLoginLabels;
  /** A signed-in reader is shown the page without a sign-in box. */
  signedIn: boolean;
};

export type LayoutProps = LandingProps & HeroExtras;
