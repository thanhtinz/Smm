import { db } from "./db";
import { getSetting } from "./settings";

export type CurrencyInfo = {
  code: string;
  name: string;
  symbol: string;
  symbolBefore: boolean;
  decimals: number;
  rate: number;
  isBase: boolean;
};

const cache = { at: 0, list: [] as CurrencyInfo[] };
const TTL = 5_000;

export async function getCurrencies(): Promise<CurrencyInfo[]> {
  if (Date.now() - cache.at < TTL && cache.list.length) return cache.list;
  const rows = await db.currency.findMany({
    where: { enabled: true },
    orderBy: [{ position: "asc" }, { code: "asc" }],
  });
  cache.list = rows.map((r) => ({
    code: r.code,
    name: r.name,
    symbol: r.symbol,
    symbolBefore: r.symbolBefore,
    decimals: r.decimals,
    rate: r.rate,
    isBase: r.isBase,
  }));
  cache.at = Date.now();
  return cache.list;
}

export function invalidateCurrencies() {
  cache.at = 0;
  cache.list = [];
}

/** All monetary columns are stored in the base currency. */
export async function getBaseCurrency(): Promise<CurrencyInfo> {
  const list = await getCurrencies();
  const baseCode = await getSetting("currency.base");
  return list.find((c) => c.code === baseCode) ?? list.find((c) => c.isBase) ?? list[0] ?? fallback;
}

const fallback: CurrencyInfo = {
  code: "VND",
  name: "Vietnamese Dong",
  symbol: "₫",
  symbolBefore: false,
  decimals: 0,
  rate: 1,
  isBase: true,
};

export function convert(amountInBase: number, to: CurrencyInfo): number {
  return amountInBase * (to.rate || 1);
}

export function formatMoney(amount: number, currency: CurrencyInfo, locale = "en"): string {
  const value = new Intl.NumberFormat(locale === "vi" ? "vi-VN" : locale, {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  }).format(amount);
  return currency.symbolBefore ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
}

/** Convert from base and format in one call. */
export function displayMoney(amountInBase: number, currency: CurrencyInfo, locale = "en"): string {
  return formatMoney(convert(amountInBase, currency), currency, locale);
}

export async function resolveCurrency(code?: string | null): Promise<CurrencyInfo> {
  const list = await getCurrencies();
  if (code) {
    const found = list.find((c) => c.code === code);
    if (found) return found;
  }
  const display = await getSetting("currency.display");
  return list.find((c) => c.code === display) ?? (await getBaseCurrency());
}
