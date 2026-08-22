import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

const { isOffline, missingFields, probeOffline, unconfiguredVerdict, verdictFromStatus } = await import("./probe");
const { seal, tlv } = await import("./emvco");

/**
 * What "Test connection" is allowed to say.
 *
 * The dangerous answer is a confident yes. An operator who is told the gateway
 * is fine stops looking, and finds out it is not when a customer's payment
 * disappears — so every case below is really asking whether a wrong
 * configuration can still come back green.
 *
 * The second job is telling "your keys are wrong" apart from "the gateway is
 * having a bad afternoon". An operator told only "failed" will go and change
 * the keys that were already correct.
 */

describe("verdictFromStatus", () => {
  it("treats every 2xx as connected", () => {
    for (const status of [200, 201, 204, 299]) expect(verdictFromStatus(status).ok).toBe(true);
  });

  // The distinction that saves an afternoon.
  it("says the credentials were refused, not that something failed", () => {
    expect(verdictFromStatus(401)).toMatchObject({ ok: false, key: "probe.badKey" });
    expect(verdictFromStatus(403)).toMatchObject({ ok: false, key: "probe.badKey" });
  });

  // Several probes deliberately ask for something that does not exist: being
  // told it does not exist means the credentials were read and accepted.
  it("counts a 404 from an authenticated probe as success", () => {
    expect(verdictFromStatus(404).ok).toBe(true);
  });

  it("blames the gateway for the gateway's own errors", () => {
    expect(verdictFromStatus(500)).toMatchObject({ ok: false, key: "probe.gatewayDown", vars: { status: 500 } });
    expect(verdictFromStatus(503).key).toBe("probe.gatewayDown");
    expect(verdictFromStatus(429)).toMatchObject({ ok: false, key: "probe.rateLimited" });
  });

  it("reports an unexpected refusal with its number rather than swallowing it", () => {
    expect(verdictFromStatus(400)).toMatchObject({ ok: false, key: "probe.rejected", vars: { status: 400 } });
    expect(verdictFromStatus(418).ok).toBe(false);
  });
});

describe("missingFields", () => {
  it("names the fields still empty, in the driver's own order", () => {
    expect(missingFields("razorpay", { keyId: "k" })).toEqual(["keySecret", "webhookSecret"]);
  });

  // Whitespace is not a key.
  it("counts a field of spaces as empty", () => {
    expect(missingFields("razorpay", { keyId: "  ", keySecret: "s", webhookSecret: "w" })).toEqual(["keyId"]);
  });

  it("is empty when everything is filled in", () => {
    expect(missingFields("razorpay", { keyId: "k", keySecret: "s", webhookSecret: "w" })).toEqual([]);
  });

  it("says nothing about a driver that does not exist", () => {
    expect(missingFields("not-a-driver", {})).toEqual([]);
  });
});

describe("unconfiguredVerdict", () => {
  it("lists what is missing rather than saying only that it failed", () => {
    expect(unconfiguredVerdict(["keySecret", "webhookSecret"])).toMatchObject({
      ok: false,
      key: "probe.missing",
      vars: { fields: "keySecret, webhookSecret" },
    });
  });
});

describe("isOffline", () => {
  it("knows which methods have nothing to call", () => {
    for (const key of ["promptpay", "paynow", "qris", "upi", "merchantqr", "manual"]) {
      expect(isOffline(key)).toBe(true);
    }
    for (const key of ["paypal", "link", "razorpay", "midtrans", "xendit", "coinbase"]) {
      expect(isOffline(key)).toBe(false);
    }
  });
});

describe("probeOffline", () => {
  it("refuses to test what has not been filled in", async () => {
    expect(await probeOffline("upi", {})).toMatchObject({ ok: false, key: "probe.missing" });
  });

  describe("PromptPay", () => {
    it("reports the account the money would reach", async () => {
      expect(await probeOffline("promptpay", { target: "0812345678", payeeName: "Nova" })).toMatchObject({
        ok: true,
        key: "probe.paysTo",
        vars: { payee: "0066812345678" },
      });
    });

    // The failure this whole button exists for: a target that produces a code
    // paying nobody, which nothing else would ever tell the operator.
    it("refuses a target that cannot be paid to", async () => {
      expect(await probeOffline("promptpay", { target: "12345", payeeName: "Nova" })).toMatchObject({
        ok: false,
        key: "probe.badTarget",
      });
    });
  });

  describe("PayNow", () => {
    it("passes a real mobile and refuses one too short to be one", async () => {
      const good = { proxyType: "mobile", proxy: "91234567", merchantName: "Nova" };
      expect(await probeOffline("paynow", good)).toMatchObject({ ok: true });
      expect(await probeOffline("paynow", { ...good, proxy: "123" })).toMatchObject({ ok: false, key: "probe.badTarget" });
    });
  });

  describe("UPI", () => {
    it("passes a real address and refuses one that is not an address", async () => {
      expect(await probeOffline("upi", { vpa: "nova@okhdfcbank", payeeName: "Nova" })).toMatchObject({ ok: true });
      expect(await probeOffline("upi", { vpa: "nova", payeeName: "Nova" })).toMatchObject({
        ok: false,
        key: "probe.badTarget",
      });
    });
  });

  describe("merchant QR", () => {
    const code = (country: string) =>
      seal(
        tlv("00", "01") +
          tlv("01", "11") +
          tlv("26", tlv("00", "MY.COM.PAYNET.MERCHANT") + tlv("01", "123456789012345")) +
          tlv("53", "458") +
          tlv("58", country) +
          tlv("59", "NOVA") +
          tlv("60", "KL"),
      );

    it("passes a code an amount can be put into", async () => {
      expect(await probeOffline("merchantqr", { staticPayload: code("MY"), country: "MY" })).toMatchObject({
        ok: true,
        key: "probe.codeReady",
      });
    });

    // Pasting the wrong country's code is the mistake this catches, and the
    // resulting QR would scan perfectly and pay nobody.
    it("refuses a code from a country other than the one configured", async () => {
      expect(await probeOffline("merchantqr", { staticPayload: code("MY"), country: "ID" })).toMatchObject({
        ok: false,
        key: "probe.badCode",
      });
    });

    it("refuses something that is not a merchant code at all", async () => {
      expect(await probeOffline("merchantqr", { staticPayload: "hello", country: "" })).toMatchObject({
        ok: false,
        key: "probe.badCode",
      });
    });
  });

  describe("SePay", () => {
    const good = { accountNumber: "0123456789", bankCode: "MB", accountName: "NOVA" };

    it("names the account and the bank the money reaches", async () => {
      expect(await probeOffline("seapay", good)).toMatchObject({ ok: true, key: "probe.paysTo" });
    });

    it("refuses a bank code NAPAS does not know", async () => {
      expect(await probeOffline("seapay", { ...good, bankCode: "NOTABANK" })).toMatchObject({
        ok: false,
        key: "probe.badBank",
        vars: { bank: "NOTABANK" },
      });
    });
  });

  describe("Perfect Money", () => {
    it("passes a U-number and refuses anything else", async () => {
      expect(await probeOffline("perfectmoney", { payeeAccount: "U1234567", passphrase: "p" })).toMatchObject({
        ok: true,
      });
      for (const account of ["1234567", "UABCDEF", "U12", "nova@example.test"]) {
        expect(await probeOffline("perfectmoney", { payeeAccount: account, passphrase: "p" })).toMatchObject({
          ok: false,
          key: "probe.badAccount",
        });
      }
    });
  });

  it("says plainly that a manual method has nothing to connect to", async () => {
    expect(
      await probeOffline("manual", { bankName: "B", accountNumber: "1", accountName: "N" }),
    ).toMatchObject({ ok: true, key: "probe.filledIn" });
  });
});
