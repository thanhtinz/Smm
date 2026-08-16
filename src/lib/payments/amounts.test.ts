import { describe, expect, it, vi } from "vitest";

// The currency table is a database read; the arithmetic on top of it is not.
// Only `decimals` matters to either function under test, so the lookup is
// stubbed and the sums are the subject.
const DECIMALS: Record<string, number> = { USD: 2, EUR: 2, VND: 0, JPY: 0, BHD: 3 };
vi.mock("@/lib/currency", () => ({
  resolveCurrency: async (code: string) => ({ code, decimals: DECIMALS[code] ?? 2 }),
}));

const { methodCurrencies, minorUnits, underpaid } = await import("./index");

describe("minorUnits", () => {
  // The bug: every gateway was handed `amount * 100`. Right for the dollar,
  // and a hundredfold overcharge for a currency whose smallest unit is the
  // unit — a 250,000 ₫ deposit asked Stripe for 25,000,000 ₫.
  it("counts in the currency's own smallest unit", async () => {
    expect(await minorUnits(25.5, "USD")).toBe(2550);
    expect(await minorUnits(250_000, "VND")).toBe(250_000);
    expect(await minorUnits(1200, "JPY")).toBe(1200);
    expect(await minorUnits(1.5, "BHD")).toBe(1500);
  });

  it("rounds rather than truncating a float", async () => {
    // 34.29657 stored unrounded is what the wallet used to write.
    expect(await minorUnits(34.29657, "USD")).toBe(3430);
    expect(await minorUnits(0.1 + 0.2, "USD")).toBe(30);
  });
});

describe("underpaid", () => {
  // The bug: the slack was a flat `+ 1`, harmless while these gateways were
  // dong-only and one whole dollar once an admin ticked USD onto SePay, MoMo
  // or ZaloPay. A $10.00 deposit was credited in full on $9.01.
  it("refuses a dollar short, which a flat one-unit slack let through", async () => {
    expect(await underpaid(9.01, 10, "USD")).toBe(true);
    expect(await underpaid(9.99, 10, "USD")).toBe(true);
  });

  it("accepts the exact amount and anything over it", async () => {
    expect(await underpaid(10, 10, "USD")).toBe(false);
    expect(await underpaid(10.5, 10, "USD")).toBe(false);
  });

  it("leaves half a subunit of slack for a float, and no more", async () => {
    expect(await underpaid(9.996, 10, "USD")).toBe(false);
    expect(await underpaid(9.994, 10, "USD")).toBe(true);
  });

  it("holds a currency without a subunit to half a unit", async () => {
    expect(await underpaid(249_999.6, 250_000, "VND")).toBe(false);
    expect(await underpaid(249_999, 250_000, "VND")).toBe(true);
    // One dong short of a 200,000 ₫ transfer is not slack.
    expect(await underpaid(199_999, 200_000, "VND")).toBe(true);
  });
});

describe("methodCurrencies", () => {
  // The hole: an empty list means "any currency the panel offers", so
  // unticking every box on a dong-only rail offered dollars — and its driver
  // rounds to whole units because the dong has none, so $25.50 would have gone
  // to the gateway as 26.
  it("falls back to what the rail can take, not to everything", () => {
    expect(methodCurrencies("momo", "[]")).toEqual(["VND"]);
    expect(methodCurrencies("zalopay", "[]")).toEqual(["VND"]);
    expect(methodCurrencies("seapay", "[]")).toEqual(["VND"]);
  });

  it("narrows a stored list that predates the restriction", () => {
    expect(methodCurrencies("momo", JSON.stringify(["VND", "USD"]))).toEqual(["VND"]);
  });

  it("leaves an unrestricted driver alone, empty list included", () => {
    expect(methodCurrencies("manual", "[]")).toEqual([]);
    expect(methodCurrencies("paypal", JSON.stringify(["USD", "EUR"]))).toEqual(["USD", "EUR"]);
  });

  it("treats an unreadable list as an empty one", () => {
    expect(methodCurrencies("momo", "not json")).toEqual(["VND"]);
    expect(methodCurrencies("manual", "not json")).toEqual([]);
  });
});
