import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { stripeSignatureFault } from "./stripe-webhook";

const SECRET = "whsec_test_secret";
const NOW = 1_700_000_000_000; // fixed, so "stale" means stale and not "the test is old"

const sign = (raw: string, at = NOW / 1000, secret = SECRET) =>
  `t=${at},v1=${createHmac("sha256", secret).update(`${at}.${raw}`).digest("hex")}`;

describe("stripeSignatureFault", () => {
  // The gateway takes the customer's money before this panel hears anything,
  // so the signature is the only thing standing between a POST and a credited
  // balance. Every way in is one case here.
  const body = JSON.stringify({ type: "checkout.session.completed", data: { object: { amount_total: 2550 } } });

  it("accepts a body signed with the configured secret", () => {
    expect(stripeSignatureFault(sign(body), body, SECRET, NOW)).toBeNull();
  });

  it("refuses a body altered after it was signed", () => {
    const header = sign(body);
    const tampered = body.replace("2550", "255000");
    expect(stripeSignatureFault(header, tampered, SECRET, NOW)).toBe("mismatch");
  });

  it("refuses a signature made with someone else's secret", () => {
    expect(stripeSignatureFault(sign(body, NOW / 1000, "whsec_not_ours"), body, SECRET, NOW)).toBe("mismatch");
  });

  it("refuses a valid signature replayed after the tolerance", () => {
    // Six minutes on: the same bytes that passed above.
    expect(stripeSignatureFault(sign(body), body, SECRET, NOW + 360_000)).toBe("stale");
    // Five minutes is still inside it.
    expect(stripeSignatureFault(sign(body), body, SECRET, NOW + 299_000)).toBeNull();
  });

  it("refuses a clock running far ahead as well as far behind", () => {
    expect(stripeSignatureFault(sign(body), body, SECRET, NOW - 360_000)).toBe("stale");
  });

  it("refuses a header with no signature in it", () => {
    expect(stripeSignatureFault("", body, SECRET, NOW)).toBe("missing");
    expect(stripeSignatureFault(`t=${NOW / 1000}`, body, SECRET, NOW)).toBe("missing");
    expect(stripeSignatureFault("v1=deadbeef", body, SECRET, NOW)).toBe("missing");
  });

  it("takes any of several v1 signatures, which is how a rotation passes", () => {
    const t = NOW / 1000;
    const good = createHmac("sha256", SECRET).update(`${t}.${body}`).digest("hex");
    expect(stripeSignatureFault(`t=${t},v1=beef,v1=${good}`, body, SECRET, NOW)).toBeNull();
  });

  it("ignores v0, which signs something else entirely", () => {
    const t = NOW / 1000;
    const v0 = createHmac("sha256", SECRET).update(`${t}.${body}`).digest("hex");
    expect(stripeSignatureFault(`t=${t},v0=${v0}`, body, SECRET, NOW)).toBe("missing");
  });

  it("does not throw on a signature of the wrong length", () => {
    // timingSafeEqual throws rather than returning false when the buffers
    // differ in size, which would have been a 500 instead of a 401.
    expect(stripeSignatureFault(`t=${NOW / 1000},v1=ab`, body, SECRET, NOW)).toBe("mismatch");
  });
});
