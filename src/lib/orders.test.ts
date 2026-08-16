import { describe, expect, it } from "vitest";
import { calculateCharge, orderCost } from "./orders";
import { applyTier } from "./pricing";
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

describe("applyTier", () => {
  it("leaves the list price alone without a tier", () => {
    expect(applyTier(null, 0.85)).toBe(0.85);
  });

  it("takes the discount off, unrounded — the charge is what gets rounded", () => {
    expect(applyTier({ discountPercent: 10 } as never, 0.85)).toBeCloseTo(0.765, 10);
  });

  it("a hand-set price wins over the tier", () => {
    expect(applyTier({ discountPercent: 50 } as never, 0.85, 0.4)).toBe(0.4);
  });

  it("never goes below zero, whatever the operator types", () => {
    expect(applyTier({ discountPercent: 500 } as never, 0.85)).toBe(0);
    expect(applyTier(null, 0.85, -5)).toBe(0);
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
