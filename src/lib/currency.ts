import { db } from "./db";
import { getSetting, settingDefinitions } from "./settings";
import { getRootPanel, runAsPanel } from "./tenancy";

export type CurrencyInfo = {
  code: string;
  name: string;
  symbol: string;
  symbolBefore: boolean;
  decimals: number;
  rate: number;
  isBase: boolean;
};

const cache = { at: 0, rows: [] as CurrencyInfo[] };
const TTL = 5_000;

/** The table as stored: every rate against whichever row carries `isBase`. */
async function currencyRows(): Promise<CurrencyInfo[]> {
  if (Date.now() - cache.at < TTL && cache.rows.length) return cache.rows;
  const rows = await db.currency.findMany({
    where: { enabled: true },
    orderBy: [{ position: "asc" }, { code: "asc" }],
  });
  cache.rows = rows.map((r) => ({
    code: r.code,
    name: r.name,
    symbol: r.symbol,
    symbolBefore: r.symbolBefore,
    decimals: r.decimals,
    rate: r.rate,
    isBase: r.isBase,
  }));
  cache.at = Date.now();
  return cache.rows;
}

/**
 * Which currency every stored amount is counted in.
 *
 * Read from the **root** panel, not the current one, and that is the whole
 * point. `Currency` is a single global table, and the wholesale chain moves
 * bare numbers between panels — a child charges its customer, the parent
 * charges the child's owner, in `Order.charge` columns that record no unit.
 * If two panels in one tree disagreed about what those numbers mean, the
 * chain would silently mix dollars with dong.
 *
 * It used to be read per panel. `createChildPanel` copies only the site name,
 * so a child created on a VND-based install fell through to the registry
 * default of USD and read every figure on its own panel through the wrong
 * anchor.
 */
async function baseCode(): Promise<string> {
  const root = await getRootPanel();
  if (!root) return String(settingDefinitions["currency.base"].value);
  return String(await runAsPanel(root.id, () => getSetting("currency.base")));
}

/**
 * Every enabled currency, with rates expressed against the panel's own base
 * rather than against whichever row happens to carry `isBase`.
 *
 * Those two are normally the same row and `setBaseCurrencyAction` rebases the
 * table to keep them that way. Normalising here anyway means `convert` is
 * right even when they have drifted — which they can, because the rate table
 * is global while the setting that names the base is not.
 */
export async function getCurrencies(): Promise<CurrencyInfo[]> {
  const rows = await currencyRows();
  const code = await baseCode();
  const anchor = rows.find((c) => c.code === code) ?? rows.find((c) => c.isBase) ?? rows[0];
  if (!anchor || !(anchor.rate > 0)) return rows;
  if (anchor.rate === 1 && anchor.isBase) return rows;
  return rows.map((c) => ({ ...c, rate: c.rate / anchor.rate, isBase: c.code === anchor.code }));
}

export function invalidateCurrencies() {
  cache.at = 0;
  cache.rows = [];
}

/** All monetary columns are stored in the base currency. */
export async function getBaseCurrency(): Promise<CurrencyInfo> {
  const list = await getCurrencies();
  const code = await baseCode();
  return list.find((c) => c.code === code) ?? list.find((c) => c.isBase) ?? list[0] ?? fallback;
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
