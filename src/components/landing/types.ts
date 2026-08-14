import type { CurrencyInfo } from "@/lib/currency";
import type { LandingData } from "@/lib/landing";

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
