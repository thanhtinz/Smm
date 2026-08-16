import { describe, expect, it } from "vitest";
import { floorMoney, formatAmount, formatDigits, formatRate, roundMoney, type MoneyShape } from "./money";

const usd: MoneyShape = { symbol: "$", symbolBefore: true, decimals: 2, numberFormat: "comma-dot" };
const vnd: MoneyShape = { symbol: "₫", symbolBefore: false, decimals: 0, numberFormat: "dot-comma" };

describe("floorMoney", () => {
  // The bug: Math.floor on a value one ulp below its own decimal truncates a
  // whole unit, so a half-delivered $2.32 order refunded $1.15 instead of
  // $1.16 and every affiliate commission came back a cent light. Swept rather
  // than sampled, because 4,586 of these were wrong and no handful of
  // examples would have found them.
  it("never loses a unit on an exact amount", () => {
    const wrong: number[] = [];
    for (let cents = 0; cents <= 100_000; cents++) {
      const value = cents / 100;
      if (Math.abs(floorMoney(value, 2) - value) > 1e-12) wrong.push(value);
    }
    expect(wrong).toEqual([]);
  });

  it("still rounds down", () => {
    expect(floorMoney(1.159, 2)).toBe(1.15);
    expect(floorMoney(0.999, 2)).toBe(0.99);
    expect(floorMoney(1.5, 0)).toBe(1);
  });

  it("pays the right share of a partial delivery", () => {
    // $2.32 order, half undelivered.
    expect(floorMoney((2.32 * 500) / 1000, 2)).toBe(1.16);
    // 5% commission on a $5.80 deposit.
    expect(floorMoney((5.8 * 5) / 100, 2)).toBe(0.29);
  });
});

describe("roundMoney", () => {
  it("rounds a half up the way a person does on paper", () => {
    // 1.005 is stored as 1.00499999999999989.
    expect(roundMoney(1.005, 2)).toBe(1.01);
    expect(roundMoney(2.675, 2)).toBe(2.68);
  });

  it("counts in the currency it is given, not in whole units", () => {
    // The defect the base-currency move exposed: a $4.25 order charged $4.
    expect(roundMoney((0.85 * 5000) / 1000, 2)).toBe(4.25);
    expect(roundMoney((0.85 * 1234) / 1000, 2)).toBe(1.05);
    // And a zero-decimal base still lands on whole units.
    expect(roundMoney(2500.7, 0)).toBe(2501);
  });
});

describe("formatDigits", () => {
  // The bug: separators came from the reader's locale, so an English visitor
  // saw the dong as 1,234,568₫ and a Vietnamese one saw the dollar as
  // $1.234.567,50. Two of four combinations wrong.
  it("writes each convention the way that convention writes numbers", () => {
    const n = 1234567.89;
    const at = (numberFormat: string) => formatDigits(n, { ...usd, numberFormat });
    expect(at("comma-dot")).toBe("1,234,567.89");
    expect(at("dot-comma")).toBe("1.234.567,89");
    expect(at("space-comma")).toBe("1 234 567,89");
    // Indian grouping is last-three then twos, which is why it is its own
    // convention rather than a pair of separators.
    expect(at("indian")).toBe("12,34,567.89");
    expect(at("plain")).toBe("1234567.89");
  });

  it("does not group below a thousand, and does group at one", () => {
    expect(formatDigits(999, vnd)).toBe("999");
    expect(formatDigits(1000, vnd)).toBe("1.000");
  });

  it("falls back rather than mangling an unknown convention", () => {
    expect(formatDigits(1234.5, { ...usd, numberFormat: "nonsense" })).toBe("1,234.50");
  });
});

describe("formatAmount", () => {
  it("puts the sign outside the symbol", () => {
    // A refund is -$5.00, never $-5.00.
    expect(formatAmount(-1234.5, usd)).toBe("-$1,234.50");
    expect(formatAmount(-2500, vnd)).toBe("-2.500₫");
  });

  it("honours which side the symbol sits on", () => {
    expect(formatAmount(1234.5, usd)).toBe("$1,234.50");
    expect(formatAmount(2500, vnd)).toBe("2.500₫");
  });
});

describe("formatRate", () => {
  // The bug: per-1,000 prices are stored to four places on purpose, and every
  // display path formatted them with the currency's two — so a catalogue
  // priced at $0.0040 and $0.0020 showed both as "$0.00" and told the
  // customer the service was free.
  it("keeps enough places to tell two cheap services apart", () => {
    expect(formatRate(0.004, usd)).toBe("$0.004");
    expect(formatRate(0.002, usd)).toBe("$0.002");
    expect(formatRate(0.004, usd)).not.toBe(formatRate(0.002, usd));
  });

  it("never trims below the places the currency has", () => {
    // $13.40 is a price; "$13.4" is a typo.
    expect(formatRate(13.4, usd)).toBe("$13.40");
    expect(formatRate(0.85, usd)).toBe("$0.85");
    expect(formatRate(1234.5, usd)).toBe("$1,234.50");
  });

  it("uses the currency's own convention", () => {
    expect(formatRate(21590, vnd)).toBe("21.590₫");
  });
});
