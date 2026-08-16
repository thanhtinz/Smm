/**
 * Rounding, in the smallest unit the panel's base currency actually has.
 *
 * Every stored amount is a number in the base currency, and every one of them
 * used to be rounded with a bare `Math.round` — correct, invisibly, for as
 * long as the base was the dong, which has no subunit. On a panel based in
 * dollars the same call rounds to the nearest dollar: a $4.25 order charges
 * $4, a 5% commission on $12.30 pays $1, and a partial refund loses its
 * cents. None of it shows up as an error; the numbers are just quietly wrong,
 * in the panel's favour or the customer's depending on the digit.
 *
 * So the precision is a parameter with no default. Every caller has to say
 * what currency it is counting in, which is the only version of this that
 * cannot silently go back to whole units the next time someone adds a price.
 */
export function roundMoney(amount: number, decimals: number): number {
  const factor = 10 ** Math.max(0, Math.min(6, Math.trunc(decimals)));
  // The extra epsilon nudge is the classic float guard: 1.005 is stored as
  // 1.00499999999999989, so a naive round gives 1.00 where a person doing
  // this on paper gets 1.01.
  return Math.round((amount + Number.EPSILON * Math.sign(amount) * Math.abs(amount)) * factor) / factor;
}

/**
 * The same, rounding down — for anything the panel pays out.
 *
 * The float guard matters more here than it does above, and it was missing.
 * `Math.floor` on a value one ulp short of its own decimal representation
 * does not lose a rounding argument, it loses a whole unit: a half-delivered
 * $2.32 order owes exactly $1.16, but `2.32 * 500 / 1000 * 100` evaluates to
 * 115.99999999999999 and flooring that refunded $1.15. Across every cent from
 * $0.00 to $1000.00, 4,586 of them came back a cent light — always in the
 * panel's favour, on commission, on partial refunds, and once per hop down
 * the wholesale chain.
 *
 * So the scaled value is settled onto the grid of real numbers before it is
 * floored. Anything genuinely below the next unit stays below it; only the
 * noise is removed.
 */
export function floorMoney(amount: number, decimals: number): number {
  const factor = 10 ** Math.max(0, Math.min(6, Math.trunc(decimals)));
  const settled = Math.round(amount * factor * 1e6) / 1e6;
  return Math.floor(settled) / factor;
}

/**
 * The shape formatting needs: everything about how a currency writes a number
 * and nothing about where it came from. Declared here rather than imported
 * from lib/currency so this module stays free of the database — the order
 * form and the wallet form are client components and import it directly.
 */
export type MoneyShape = {
  symbol: string;
  symbolBefore: boolean;
  decimals: number;
  numberFormat: string;
};

/**
 * How a currency punctuates its digits.
 *
 * This belongs to the currency, not to the reader, and it used to be taken
 * from the reader's locale — so an English visitor saw the dong as
 * "1,234,568₫" and a Vietnamese one saw the dollar as "$1.234.567,50". Two of
 * the four combinations were wrong. A price in dong is written the Vietnamese
 * way to everybody, the same way $1,234.56 is written that way to everybody;
 * how many of something you have is what follows the reader, and that stays
 * with `formatCount` in lib/numbers.ts.
 *
 * Offered as five named conventions rather than two boxes to type punctuation
 * into: an operator picks one by looking at the sample, and cannot set the
 * group and decimal marks to the same character.
 */
export const NUMBER_FORMATS = ["comma-dot", "dot-comma", "space-comma", "indian", "plain"] as const;
export type NumberFormat = (typeof NUMBER_FORMATS)[number];

const MARKS: Record<NumberFormat, { group: string; decimal: string }> = {
  "comma-dot": { group: ",", decimal: "." },
  "dot-comma": { group: ".", decimal: "," },
  // A non-breaking space, so a price never wraps mid-number.
  "space-comma": { group: "\u00a0", decimal: "," },
  indian: { group: ",", decimal: "." },
  plain: { group: "", decimal: "." },
};

function marksFor(format: string) {
  return MARKS[(NUMBER_FORMATS as readonly string[]).includes(format) ? (format as NumberFormat) : "comma-dot"];
}

/**
 * Digits, grouped. Threes from the right everywhere except the Indian system,
 * which groups the last three and then twos — 12,34,568, not 1,234,568.
 */
function group(digits: string, format: string): string {
  const { group: mark } = marksFor(format);
  if (!mark || digits.length < 4) return digits;

  if (format === "indian") {
    const last = digits.slice(-3);
    const rest = digits.slice(0, -3);
    return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, mark)}${mark}${last}`;
  }
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, mark);
}

/**
 * The digits of one amount, unsigned and without a symbol, written the way its
 * own currency writes numbers. The sign is the caller's to place, because it
 * goes outside the symbol — a refund is -$5.00, never $-5.00.
 */
export function formatDigits(amount: number, currency: MoneyShape): string {
  const { decimal } = marksFor(currency.numberFormat);
  const fixed = Math.abs(amount).toFixed(Math.max(0, Math.min(8, currency.decimals)));
  const [whole, fraction] = fixed.split(".");
  const grouped = group(whole, currency.numberFormat);
  return fraction ? `${grouped}${decimal}${fraction}` : grouped;
}

/**
 * An amount with its symbol, written the way its own currency writes numbers.
 *
 * `locale` is not a parameter and that is the point: punctuation belongs to
 * the currency. How many of something you have follows the reader instead —
 * that is `formatCount` in lib/numbers.ts.
 */
export function formatAmount(amount: number, currency: MoneyShape): string {
  const value = formatDigits(amount, currency);
  const body = currency.symbolBefore ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
  // Outside the symbol: a refund reads -$5.00, not $-5.00.
  return amount < 0 ? `-${body}` : body;
}
