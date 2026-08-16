import { describe, expect, it } from "vitest";
import { calculateCharge, checkIncrement, orderCost, subscriptionFields } from "./orders";
import { withOverflow } from "./providers";
import { applyPricing } from "./pricing";
import { convert, type CurrencyInfo } from "./currency";

const money = (over: Partial<CurrencyInfo>): CurrencyInfo => ({
  code: "X",
  name: "X",
  symbol: "$",
  symbolBefore: true,
  decimals: 2,
  numberFormat: "comma-dot",
  rate: 1,
  isBase: false,
  ...over,
});

describe("calculateCharge", () => {
  it("charges to the base currency's precision", () => {
    // The whole point of the decimals argument: a bare Math.round here
    // charged $4 for a $4.25 order the moment the base gained a subunit.
    expect(calculateCharge(0.85, 5000, 2)).toBe(4.25);
    expect(calculateCharge(0.85, 1234, 2)).toBe(1.05);
    expect(calculateCharge(13.4, 5000, 2)).toBe(67);
  });

  it("still deals in whole units for a currency without a subunit", () => {
    expect(calculateCharge(62_000, 5000, 0)).toBe(310_000);
  });

  it("rounds a quantity too small to cost anything down to nothing", () => {
    expect(calculateCharge(0.02, 100, 2)).toBe(0);
  });
});

describe("orderCost", () => {
  it("records nothing where the panel has no cost to record", () => {
    expect(orderCost(0, 5000, 2)).toBeNull();
  });

  it("costs to the same precision as the charge", () => {
    expect(orderCost(0.527, 5000, 2)).toBe(2.64);
  });
});

describe("applyPricing", () => {
  const priced = (tierOff: number, userOff = 0) => ({
    tier: tierOff ? ({ discountPercent: tierOff } as never) : null,
    userId: "u1",
    discountPercent: userOff,
  });

  it("leaves the list price alone without a tier", () => {
    expect(applyPricing(null, 0.85)).toBe(0.85);
    expect(applyPricing(priced(0), 0.85)).toBe(0.85);
  });

  it("takes the discount off, unrounded — the charge is what gets rounded", () => {
    expect(applyPricing(priced(10), 0.85)).toBeCloseTo(0.765, 10);
  });

  it("a hand-set price wins over both discounts", () => {
    expect(applyPricing(priced(50, 20), 0.85, 0.4)).toBe(0.4);
  });

  it("compounds the customer's own discount onto the tier's", () => {
    // Not 0.85 * (1 - 0.6). Two halves of a price is a quarter of it, and
    // adding the percentages instead is what lets two 60s reach free.
    expect(applyPricing(priced(50, 50), 0.85)).toBeCloseTo(0.2125, 10);
    expect(applyPricing(priced(0, 10), 0.85)).toBeCloseTo(0.765, 10);
  });

  it("never goes below zero, whatever the operator types", () => {
    expect(applyPricing(priced(500), 0.85)).toBe(0);
    expect(applyPricing(priced(0, 500), 0.85)).toBe(0);
    expect(applyPricing(priced(-50, -50), 0.85)).toBe(0.85);
    expect(applyPricing(null, 0.85, -5)).toBe(0);
  });
});

describe("convert", () => {
  // The bug: convert multiplied by the target's rate and assumed the base's
  // was 1. Currency is one global table anchored on whichever row carries
  // isBase, but currency.base was read per panel — so a child created on a
  // VND-anchored install resolved USD as its base and read every figure
  // through the wrong anchor. $10 displayed as "$0.00".
  it("is the identity for the base currency", () => {
    expect(convert(10, money({ rate: 1, isBase: true }))).toBe(10);
  });

  it("converts by the rate once the list is normalised", () => {
    // getCurrencies divides every rate by the base's before this ever runs,
    // which is what makes the assumption above safe to hold here.
    expect(convert(10, money({ code: "VND", rate: 25_400, decimals: 0 }))).toBe(254_000);
  });

  it("treats a missing rate as one rather than as zero", () => {
    expect(convert(10, money({ rate: 0 }))).toBe(10);
  });
});

describe("checkIncrement", () => {
  const svc = (increment: number, min = 100, max = 10000) => ({ min, max, increment });

  it("says nothing when there is no step", () => {
    expect(checkIncrement(1050, svc(0))).toBeNull();
    // A step of one is every whole number, so it is not a step.
    expect(checkIncrement(1050, svc(1))).toBeNull();
  });

  it("passes a quantity already on the step", () => {
    expect(checkIncrement(1000, svc(100))).toBeNull();
  });

  it("suggests the nearest multiple, rounding down", () => {
    expect(checkIncrement(1050, svc(100))).toEqual({ suggestion: 1000 });
  });

  it("rounds up rather than suggesting a quantity under the minimum", () => {
    // 150 down is 100, which is the minimum, so down still works...
    expect(checkIncrement(150, svc(100, 100))).toEqual({ suggestion: 100 });
    // ...but with a minimum of 150 there is nothing below to round to.
    expect(checkIncrement(160, svc(100, 150))).toEqual({ suggestion: 200 });
  });

  it("never suggests more than the maximum allows", () => {
    expect(checkIncrement(9950, svc(100, 100, 9990))).toEqual({ suggestion: 9900 });
  });
});

describe("withOverflow", () => {
  it("orders exactly what was bought when the buffer is off", () => {
    expect(withOverflow(1000, 0)).toBe(1000);
    expect(withOverflow(1000, -5)).toBe(1000);
  });

  it("adds the buffer on top", () => {
    expect(withOverflow(1000, 10)).toBe(1100);
  });

  it("rounds up, so a small order still gets a buffer", () => {
    // 1% of 100 is 1, and a buffer that rounds to nothing is a setting that
    // silently does not work on exactly the orders that need it least noticed.
    expect(withOverflow(100, 0.5)).toBe(101);
  });
});

describe("subscriptionFields", () => {
  const sub = { username: "a", posts: 5, minPerPost: 10, maxPerPost: 20, delay: 15, expiry: null };

  it("is all nulls for an ordinary order", () => {
    expect(subscriptionFields(null)).toEqual({
      posts: null,
      oldPosts: null,
      minPerPost: null,
      maxPerPost: null,
      delay: null,
      expiry: null,
    });
  });

  it("counts future posts for a subscription", () => {
    expect(subscriptionFields(sub)).toMatchObject({ posts: 5, oldPosts: null, delay: 15 });
  });

  it("counts existing posts for a spread, and waits for nothing", () => {
    expect(subscriptionFields(sub, true)).toMatchObject({ posts: null, oldPosts: 5, delay: null, expiry: null });
  });

  it("reads the kind off the value when it carries one", () => {
    // How a held spread keeps being a spread when it is released and re-sent.
    expect(subscriptionFields({ ...sub, spread: true })).toMatchObject({ posts: null, oldPosts: 5 });
  });
});
