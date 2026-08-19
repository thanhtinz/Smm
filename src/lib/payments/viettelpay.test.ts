import { describe, expect, it } from "vitest";
import { checksumMatches, isPaid, signIpn, signOrder } from "./viettelpay";

describe("viettelpay", () => {
  it("signs create-order payloads deterministically", () => {
    const values = {
      merchant_code: "M001",
      order_id: "NOVA100001",
      amount: "50000",
      currency: "VND",
      order_desc: "Top up",
      return_url: "https://panel.test/return",
      notify_url: "https://panel.test/ipn",
      version: "2.0",
    };
    const a = signOrder(values, "secret");
    const b = signOrder(values, "secret");
    expect(a).toBe(b);
    expect(a).toHaveLength(32);
  });

  it("verifies IPN checksums", () => {
    const payload = {
      merchant_code: "M001",
      order_id: "NOVA100001",
      amount: "50000",
      response_code: "00",
      transaction_id: "VT123",
      version: "2.0",
    };
    const check_sum = signIpn(payload, "secret");
    expect(checksumMatches(check_sum, check_sum)).toBe(true);
    expect(checksumMatches(check_sum, "deadbeef")).toBe(false);
  });

  it("treats response code 00 as paid", () => {
    expect(isPaid("00")).toBe(true);
    expect(isPaid("99")).toBe(false);
  });
});
