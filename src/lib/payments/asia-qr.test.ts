import { describe, expect, it } from "vitest";
import { checksumValid, parse, seal, tlv } from "./emvco";
import { buildPayNow, buildPromptPay, buildQris, buildUpi, promptPayTarget } from "./asia-qr";

/**
 * A payment QR fails in one direction only: silently.
 *
 * Nothing throws when the checksum is wrong, when a phone number is padded to
 * the wrong length, or when an amount lands in the wrong field — the customer
 * simply scans a code that pays somebody else, or nobody, and the operator
 * finds out from a support ticket. So every code built here is parsed back and
 * checked field by field, rather than compared to a string somebody typed.
 */

/** The value of one tag, from a payload, without trusting string search. */
const field = (payload: string, tag: string) => parse(payload)?.find((f) => f.tag === tag)?.value;
const nested = (payload: string, outer: string, inner: string) => {
  const block = field(payload, outer);
  return block ? parse(block)?.find((f) => f.tag === inner)?.value : undefined;
};

describe("promptPayTarget", () => {
  // Getting this wrong pays a different phone number, which is the worst
  // possible failure and the least visible.
  it("normalises every way a Thai mobile is written to the same thirteen digits", () => {
    for (const written of ["0812345678", "812345678", "66812345678", "+66 81 234 5678", "0066812345678"]) {
      expect(promptPayTarget(written)).toEqual({ tag: "01", value: "0066812345678" });
    }
  });

  it("recognises a national ID and an e-wallet id by their length", () => {
    expect(promptPayTarget("1234567890123")).toEqual({ tag: "02", value: "1234567890123" });
    expect(promptPayTarget("123456789012345")).toEqual({ tag: "03", value: "123456789012345" });
  });

  it("refuses what cannot be a payee rather than padding it into one", () => {
    expect(promptPayTarget("")).toBeNull();
    expect(promptPayTarget("abc")).toBeNull();
    expect(promptPayTarget("12345")).toBeNull();
  });
});

describe("buildPromptPay", () => {
  const payload = buildPromptPay({ target: "0812345678", amount: 250.5 })!;

  it("produces a payload whose own checksum agrees with it", () => {
    expect(checksumValid(payload)).toBe(true);
  });

  it("names Thailand, the baht and the PromptPay application", () => {
    expect(field(payload, "58")).toBe("TH");
    expect(field(payload, "53")).toBe("764");
    expect(nested(payload, "29", "00")).toBe("A000000677010111");
    expect(nested(payload, "29", "01")).toBe("0066812345678");
  });

  it("carries the amount to two places, where the standard puts it", () => {
    expect(field(payload, "54")).toBe("250.50");
    expect(field(payload, "01")).toBe("12");
  });

  it("is a re-usable code when no amount is named", () => {
    const open = buildPromptPay({ target: "0812345678" })!;
    expect(field(open, "01")).toBe("11");
    expect(field(open, "54")).toBeUndefined();
    expect(checksumValid(open)).toBe(true);
  });

  it("refuses rather than emitting a code that pays nobody", () => {
    expect(buildPromptPay({ target: "nonsense", amount: 10 })).toBeNull();
  });
});

describe("buildPayNow", () => {
  const payload = buildPayNow({ proxyType: "mobile", proxy: "91234567", merchantName: "Nova Panel", amount: 42 })!;

  it("produces a payload whose own checksum agrees with it", () => {
    expect(checksumValid(payload)).toBe(true);
  });

  it("addresses the payee the way PayNow expects", () => {
    expect(nested(payload, "26", "00")).toBe("SG.PAYNOW");
    expect(nested(payload, "26", "01")).toBe("0");
    expect(nested(payload, "26", "02")).toBe("+6591234567");
    expect(field(payload, "53")).toBe("702");
    expect(field(payload, "58")).toBe("SG");
  });

  // A code that names the amount and still lets the payer edit it is how an
  // operator gets paid three dollars for a thirty dollar top-up.
  it("locks the amount when it names one, and leaves it open when it does not", () => {
    expect(nested(payload, "26", "03")).toBe("0");
    const open = buildPayNow({ proxyType: "uen", proxy: "201912345k", merchantName: "Nova" })!;
    expect(nested(open, "26", "03")).toBe("1");
    expect(nested(open, "26", "01")).toBe("2");
    expect(nested(open, "26", "02")).toBe("201912345K");
  });

  it("always carries a merchant name, which PayNow requires", () => {
    const unnamed = buildPayNow({ proxyType: "mobile", proxy: "91234567", merchantName: "" })!;
    expect(field(unnamed, "59")).toBe("NA");
    expect(field(unnamed, "60")).toBeTruthy();
  });

  it("refuses a mobile that is too short to be one", () => {
    expect(buildPayNow({ proxyType: "mobile", proxy: "123", merchantName: "Nova" })).toBeNull();
  });
});

describe("buildQris", () => {
  // A merchant's static code, of the shape their acquirer issues. Assembled
  // with the primitives rather than typed out, because a hand-counted length
  // in a 200-character fixture is a failing test that says nothing about the
  // code under test.
  const staticQris = seal(
    tlv("00", "01") +
      tlv("01", "11") +
      tlv("26", tlv("00", "ID.CO.QRIS.WWW") + tlv("01", "936000918000000000") + tlv("02", "ID1020000000000")) +
      tlv("51", tlv("00", "ID.CO.QRIS.WWW") + tlv("02", "ID1020000000000") + tlv("03", "UME")) +
      tlv("52", "5812") +
      tlv("53", "360") +
      tlv("58", "ID") +
      tlv("59", "NOVA STORE") +
      tlv("60", "JAKARTA") +
      tlv("61", "12340"),
  );

  it("has a fixture that is itself a valid code", () => {
    expect(parse(staticQris)).not.toBeNull();
    expect(checksumValid(staticQris)).toBe(true);
  });

  it("turns the merchant's own code into one that names this deposit", () => {
    const dynamic = buildQris(staticQris, 125_000)!;
    expect(checksumValid(dynamic)).toBe(true);
    expect(field(dynamic, "54")).toBe("125000.00");
    expect(field(dynamic, "01")).toBe("12");
  });

  it("leaves the merchant's own blocks exactly as issued", () => {
    const dynamic = buildQris(staticQris, 1000)!;
    for (const tag of ["26", "51", "52", "53", "58", "59", "60"]) {
      expect(field(dynamic, tag)).toBe(field(staticQris, tag));
    }
  });

  it("puts the amount in tag order rather than on the end", () => {
    const tags = parse(buildQris(staticQris, 1000)!)!.map((f) => f.tag);
    expect(tags.indexOf("54")).toBeLessThan(tags.indexOf("58"));
  });

  it("replaces an amount already present instead of writing a second one", () => {
    const once = buildQris(staticQris, 1000)!;
    const twice = buildQris(once, 2000)!;
    expect(parse(twice)!.filter((f) => f.tag === "54")).toHaveLength(1);
    expect(field(twice, "54")).toBe("2000.00");
  });

  // The refusals matter: a mangled code still scans, and pays nobody.
  it("refuses what is not an Indonesian merchant code", () => {
    expect(buildQris("not a payload", 1000)).toBeNull();
    expect(buildQris("", 1000)).toBeNull();
    // Well-formed, but Vietnamese.
    expect(buildQris(staticQris.replace("5802ID", "5802VN"), 1000)).toBeNull();
  });

  it("refuses an amount that is not one", () => {
    expect(buildQris(staticQris, 0)).toBeNull();
    expect(buildQris(staticQris, -5)).toBeNull();
  });
});

describe("buildUpi", () => {
  it("builds the link a UPI app opens", () => {
    const link = buildUpi({ vpa: "nova@okhdfcbank", payeeName: "Nova Panel", amount: 500, reference: "NOVA1042" })!;
    const url = new URL(link);
    expect(url.protocol).toBe("upi:");
    expect(url.searchParams.get("pa")).toBe("nova@okhdfcbank");
    expect(url.searchParams.get("am")).toBe("500.00");
    expect(url.searchParams.get("cu")).toBe("INR");
    expect(url.searchParams.get("tr")).toBe("NOVA1042");
  });

  it("leaves the amount out when there is none, rather than sending zero", () => {
    const url = new URL(buildUpi({ vpa: "nova@okhdfcbank", payeeName: "Nova" })!);
    expect(url.searchParams.get("am")).toBeNull();
  });

  it("refuses an address that is not a payee address", () => {
    for (const vpa of ["", "nova", "@bank", "nova@", "no spaces@bank"]) {
      expect(buildUpi({ vpa, payeeName: "Nova" })).toBeNull();
    }
  });
});
