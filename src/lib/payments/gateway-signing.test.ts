import { describe, expect, it } from "vitest";
import {
  binancePaySign,
  hmacOverBody,
  midtransSignature,
  payosSignature,
  cryptomusSign,
  cryptomusWebhookValid,
  payeerCallbackFields,
  payeerFormFields,
  payeerSign,
  perfectMoneyHash,
  signaturesMatch,
} from "./gateway-signing";

/**
 * These are pinned against values computed outside this codebase — python's
 * hashlib, not another call to node's crypto — because a test that hashes with
 * the same function it is testing proves only that the function is consistent
 * with itself. What is being checked is that this panel agrees with the
 * gateway, and the gateway is not written in TypeScript either.
 *
 * A wrong signature here fails in one of two ways: real payments are rejected,
 * or invented ones are accepted. The second is free credit.
 */

const BODY = '{"amount":"10.00","currency":"USD","order_id":"NOVA1042"}';

describe("cryptomusSign", () => {
  it("matches a signature computed outside this codebase", () => {
    expect(cryptomusSign(BODY, "test-api-key")).toBe("99266d904ffe58ae77fc15261241518a");
  });

  it("changes when the body changes by one character", () => {
    expect(cryptomusSign(BODY.replace("10.00", "10.01"), "test-api-key")).not.toBe(
      "99266d904ffe58ae77fc15261241518a",
    );
  });

  it("changes when the key changes", () => {
    expect(cryptomusSign(BODY, "other-key")).not.toBe("99266d904ffe58ae77fc15261241518a");
  });
});

describe("cryptomusWebhookValid", () => {
  const payload = (over: Record<string, unknown> = {}) => {
    const body = { status: "paid", order_id: "NOVA1042", amount: "10.00", ...over };
    const sign = cryptomusSign(JSON.stringify(body), "test-api-key");
    return JSON.stringify({ ...body, sign });
  };

  it("accepts a callback the gateway signed", () => {
    expect(cryptomusWebhookValid(payload(), "test-api-key")).toBe(true);
  });

  // The whole point: the body is written by whoever can reach the URL.
  it("refuses a callback whose amount was edited after signing", () => {
    const signed = JSON.parse(payload()) as Record<string, unknown>;
    signed.amount = "1000.00";
    expect(cryptomusWebhookValid(JSON.stringify(signed), "test-api-key")).toBe(false);
  });

  it("refuses a callback with no signature at all", () => {
    expect(cryptomusWebhookValid('{"status":"paid","order_id":"NOVA1042"}', "test-api-key")).toBe(false);
  });

  it("refuses a callback signed with somebody else's key", () => {
    expect(cryptomusWebhookValid(payload(), "wrong-key")).toBe(false);
  });

  it("refuses what is not JSON rather than throwing", () => {
    expect(cryptomusWebhookValid("not json", "test-api-key")).toBe(false);
    expect(cryptomusWebhookValid("", "test-api-key")).toBe(false);
  });
});

describe("binancePaySign", () => {
  it("matches a signature computed outside this codebase", () => {
    expect(
      binancePaySign({
        timestamp: "1700000000000",
        nonce: "abcdef0123456789abcdef0123456789",
        body: BODY,
        secret: "test-secret",
      }),
    ).toBe(
      "7152A5A6ACA43D0AF52285230B210E1C68CD184CC7EE798FD1E75677A1643B23DBB921D2780CDD5F2B056AF4C6045CA9C4677AE90BE3D9C283920CF19C45207F",
    );
  });

  // The newline after the body is part of what is signed. Leaving it off is
  // the classic mistake and produces a rejection with no explanation.
  it("is upper case, as the header expects", () => {
    const sig = binancePaySign({ timestamp: "1", nonce: "n", body: "{}", secret: "s" });
    expect(sig).toBe(sig.toUpperCase());
  });

  it("changes when the nonce changes, so a signature cannot be replayed", () => {
    const a = binancePaySign({ timestamp: "1", nonce: "n1", body: BODY, secret: "s" });
    const b = binancePaySign({ timestamp: "1", nonce: "n2", body: BODY, secret: "s" });
    expect(a).not.toBe(b);
  });
});

describe("payeerSign", () => {
  it("matches a signature computed outside this codebase", () => {
    const fields = payeerFormFields({
      shopId: "12345",
      orderId: "NOVA1042",
      amount: "10.00",
      currency: "USD",
      descriptionBase64: Buffer.from("Balance top-up").toString("base64"),
    });
    expect(payeerSign(fields, "shop-secret")).toBe(
      "4DED9E7218B064ADAE8B093B06778C5309B0C51459820DABA990A300DF294CB6",
    );
  });

  it("keeps the gateway's field order rather than sorting it", () => {
    expect(payeerFormFields({ shopId: "1", orderId: "2", amount: "3", currency: "4", descriptionBase64: "5" })).toEqual(
      ["1", "2", "3", "4", "5"],
    );
  });

  it("signs a callback over every field the gateway includes, missing ones as blanks", () => {
    const fields = payeerCallbackFields({ m_shop: "12345", m_orderid: "NOVA1042", m_status: "success" });
    expect(fields).toHaveLength(10);
    expect(fields[4]).toBe("12345");
    expect(fields[9]).toBe("success");
    expect(fields[0]).toBe("");
  });
});

describe("perfectMoneyHash", () => {
  it("matches a hash computed outside this codebase", () => {
    expect(
      perfectMoneyHash({
        paymentId: "PID1",
        payeeAccount: "U1234567",
        paymentAmount: "10.00",
        paymentUnits: "USD",
        paymentBatchNum: "BATCH1",
        payerAccount: "U7654321",
        passphrase: "pass phrase",
        timestampGmt: "1700000000",
      }),
    ).toBe("B7F611E8FC30E0591E1430A0C99FF72E");
  });

  it("changes when the amount is edited, which is the attack", () => {
    const args = {
      paymentId: "PID1",
      payeeAccount: "U1234567",
      paymentAmount: "10.00",
      paymentUnits: "USD",
      paymentBatchNum: "BATCH1",
      payerAccount: "U7654321",
      passphrase: "pass phrase",
      timestampGmt: "1700000000",
    };
    expect(perfectMoneyHash({ ...args, paymentAmount: "1000.00" })).not.toBe(perfectMoneyHash(args));
  });
});

describe("signaturesMatch", () => {
  it("accepts the same signature whatever case it arrives in", () => {
    expect(signaturesMatch("ABCDEF", "abcdef")).toBe(true);
  });

  it("refuses a different signature, a truncated one, and an empty one", () => {
    expect(signaturesMatch("abcdef", "abcdee")).toBe(false);
    expect(signaturesMatch("abcdef", "abc")).toBe(false);
    expect(signaturesMatch("abcdef", "")).toBe(false);
    expect(signaturesMatch("", "")).toBe(false);
  });
});

describe("hmacOverBody", () => {
  const raw = '{"event":"charge:confirmed","data":{"code":"AB12"}}';

  it("matches Coinbase Commerce, computed outside this codebase", () => {
    expect(hmacOverBody(raw, "cb-secret", "sha256")).toBe(
      "553cd620dec4c70c4a7d800b7529f21c168da600d51eeb955e03e6a6ea405174",
    );
  });

  it("matches OxaPay, computed outside this codebase", () => {
    expect(hmacOverBody(raw, "ox-key", "sha512")).toBe(
      "837ecff1962188b72353d12361bd513360e33c7906ec45deeb4d555363068b92ae8680658d24504c5bb94cf07853367bb7f690dc505c0290413f886a9135eb20",
    );
  });

  it("matches Razorpay, computed outside this codebase", () => {
    expect(hmacOverBody(raw, "rzp-secret", "sha256")).toBe(
      "3b7595b86ae835fa0698431dfedb5599cacffa92507d269809bfd588c542f3fe",
    );
  });

  it("matches CoinPayments over a form body", () => {
    expect(hmacOverBody("merchant=m1&status=100&amount1=10.00", "cp-ipn-secret", "sha512")).toBe(
      "bc4bbfc34e3c0c900e66d90af2bf9952f6326c790f936e2089fb35cf885209456a68d898f49441a2cf3d53b5599b8bc4cec2d3dcd5f0c56558ad70aa1f180154",
    );
  });

  // Re-serialising a parsed body before hashing is what breaks all four of
  // these, and it breaks them for payloads that differ only in whitespace.
  it("is over the exact bytes, so whitespace changes the answer", () => {
    expect(hmacOverBody('{"a":1}', "k", "sha256")).not.toBe(hmacOverBody('{ "a": 1 }', "k", "sha256"));
  });
});

describe("midtransSignature", () => {
  it("matches a signature computed outside this codebase", () => {
    expect(
      midtransSignature({ orderId: "NOVA1042", statusCode: "200", grossAmount: "10000.00", serverKey: "srv-key" }),
    ).toBe(
      "e5b9570386d3e1509548d0d56ab838aef8505236d409f60da6f1cbe1d4e3d541e1b3b4df156733e0c07bd129cd8b95df724a8adaac5579bb8a3f04fce5e90d67",
    );
  });

  // The amount is hashed as the string they sent it as. Reformatting it here
  // produces a signature that never matches, for every single payment.
  it("treats the amount as the string it arrived as", () => {
    const a = midtransSignature({ orderId: "o", statusCode: "200", grossAmount: "10000.00", serverKey: "k" });
    const b = midtransSignature({ orderId: "o", statusCode: "200", grossAmount: "10000", serverKey: "k" });
    expect(a).not.toBe(b);
  });
});

describe("payosSignature", () => {
  it("matches a signature computed outside this codebase", () => {
    expect(payosSignature({ orderCode: 1042, amount: 10000, description: "NOVA1042" }, "po-checksum")).toBe(
      "ce21860d37b4358b7b375b07aff807115a1ee8e5710f31d1dc8839d9b22cd9a2",
    );
  });

  // Whatever order the sender serialised its JSON in, the signature is the
  // same — which is the entire reason the keys are sorted.
  it("does not depend on the order the fields arrived in", () => {
    const a = payosSignature({ orderCode: 1042, amount: 10000, description: "NOVA1042" }, "k");
    const b = payosSignature({ description: "NOVA1042", amount: 10000, orderCode: 1042 }, "k");
    expect(a).toBe(b);
  });

  it("writes a missing value as empty rather than as the word null", () => {
    expect(payosSignature({ a: null, b: "x" }, "k")).toBe(payosSignature({ a: "", b: "x" }, "k"));
  });
});
