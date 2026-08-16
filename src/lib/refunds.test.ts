import { describe, expect, it, vi } from "vitest";

// Only the base currency's precision is read, and that is a settings lookup.
let decimals = 2;
vi.mock("@/lib/currency", () => ({
  getBaseCurrency: async () => ({ code: "USD", decimals }),
}));

const { refundOwed } = await import("./refunds");

/** A stand-in for the Prisma handle, holding what has already been paid back. */
const client = (alreadyRefunded: number) => ({
  transaction: {
    aggregate: async () => ({ _sum: { amount: alreadyRefunded || null } }),
  },
});

const order = (charge: number) => ({ userId: "u1", publicId: 100_482, charge });

describe("refundOwed", () => {
  it("owes the whole charge on an order nothing has been paid back for", async () => {
    expect(await refundOwed(client(0), order(10))).toBe(10);
  });

  // The bug this exists for: a $10 order goes to `processing`, the customer
  // opens a cancel request, the provider reports 30% delivered and $3.00 goes
  // back, then the operator approves the cancellation. The approval path added
  // `order.charge` outright and only refused to run on `canceled`/`refunded` —
  // `partial` was not in that set — so the customer was handed $13.00 for a
  // $10.00 order.
  it("owes only the remainder once a partial has been paid back", async () => {
    expect(await refundOwed(client(3), order(10))).toBe(7);
  });

  it("owes nothing on an order already settled in full", async () => {
    expect(await refundOwed(client(10), order(10))).toBe(0);
  });

  it("never owes a negative amount, whatever the ledger says", async () => {
    // A hand-written adjustment can put more back than the order cost; that is
    // not a debt the customer owes the panel.
    expect(await refundOwed(client(12), order(10))).toBe(0);
  });

  it("settles to the base currency's precision rather than leaving a stray unit", async () => {
    // Two partial refunds of a $2.33 order, each a rounded share.
    expect(await refundOwed(client(1.16 + 1.17), order(2.33))).toBe(0);
    // And the remainder of a share that does not divide evenly.
    expect(await refundOwed(client(0.29), order(5.8))).toBe(5.51);
  });

  it("counts in whole units where the base currency has no subunit", async () => {
    decimals = 0;
    try {
      expect(await refundOwed(client(60_000), order(250_000))).toBe(190_000);
      expect(await refundOwed(client(0), order(250_000.4))).toBe(250_000);
    } finally {
      decimals = 2;
    }
  });
});
