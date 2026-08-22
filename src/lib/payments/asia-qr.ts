import { build, parse, seal, tlv, type Field } from "./emvco";

/**
 * The QR rails the rest of Asia actually pays on.
 *
 * Vietnam already had VietQR. Thailand pays by PromptPay, Singapore by PayNow,
 * Indonesia by QRIS, India by UPI — and in every one of them the customer
 * scans a code and the money arrives in the operator's own account, with no
 * gateway in between and nothing to sign up for.
 *
 * Every code here is generated on this machine, exactly like VietQR: no
 * outbound request at render time, and the amount and reference encoded are
 * the ones the operator later reconciles against.
 *
 * Deliberately absent: DuitNow, GCash, OVO, DANA and the other wallet rails.
 * Each needs either an acquirer agreement or a merchant profile whose exact
 * payload this panel cannot verify, and a QR built from a guess is a customer
 * whose money goes nowhere. They are better served by the manual method until
 * an operator has real credentials to test against.
 */

/** Two decimal places, which is what every scheme here expects. */
function money(amount: number): string {
  return amount.toFixed(2);
}

/** Strips a display-formatted phone number down to digits. */
function digits(value: string): string {
  return value.replace(/\D+/g, "");
}

// ------------------------------------------------------------- PromptPay (TH)

export type PromptPayInput = {
  /** A Thai mobile number, a 13-digit national ID, or a 15-digit e-wallet id. */
  target: string;
  amount?: number;
};

/**
 * PromptPay addresses a payee three ways and tells them apart by length.
 *
 * A mobile number is normalised to 0066XXXXXXXXX: the leading zero of the
 * local form is dropped, the country code goes on, and the result is padded to
 * thirteen. Getting this wrong sends the money to a different phone number, so
 * the shape is decided here rather than left to whatever the operator typed.
 */
export function promptPayTarget(target: string): { tag: string; value: string } | null {
  const raw = digits(target);
  if (!raw) return null;

  if (raw.length === 15) return { tag: "03", value: raw };
  if (raw.length === 13 && !raw.startsWith("0066")) return { tag: "02", value: raw };

  // A mobile, in any of the forms a person writes one.
  let national = raw;
  if (national.startsWith("0066")) national = national.slice(4);
  else if (national.startsWith("66")) national = national.slice(2);
  if (national.startsWith("0")) national = national.slice(1);
  if (national.length < 8 || national.length > 10) return null;

  return { tag: "01", value: `66${national}`.padStart(13, "0") };
}

export function buildPromptPay({ target, amount }: PromptPayInput): string | null {
  const payee = promptPayTarget(target);
  if (!payee) return null;

  const merchant = tlv("00", "A000000677010111") + tlv(payee.tag, payee.value);

  const payload =
    tlv("00", "01") +
    // 11 is a code that is scanned again and again; one carrying an amount is
    // for a single payment.
    tlv("01", amount ? "12" : "11") +
    tlv("29", merchant) +
    tlv("53", "764") +
    (amount ? tlv("54", money(amount)) : "") +
    tlv("58", "TH");

  return seal(payload);
}

// ---------------------------------------------------------------- PayNow (SG)

export type PayNowInput = {
  /** "mobile" addresses a person, "uen" addresses a registered business. */
  proxyType: "mobile" | "uen";
  proxy: string;
  merchantName: string;
  amount?: number;
  /** YYYYMMDD, after which the code stops being accepted. */
  expiry?: string;
};

export function buildPayNow({ proxyType, proxy, merchantName, amount, expiry }: PayNowInput): string | null {
  const value = proxyType === "mobile" ? `+65${digits(proxy).replace(/^65/, "")}` : proxy.trim().toUpperCase();
  if (proxyType === "mobile" ? digits(proxy).length < 8 : !value) return null;

  const merchant =
    tlv("00", "SG.PAYNOW") +
    tlv("01", proxyType === "mobile" ? "0" : "2") +
    tlv("02", value) +
    // Whether the payer may change the amount. A code that names one is not
    // one they should be able to edit.
    tlv("03", amount ? "0" : "1") +
    (expiry ? tlv("04", expiry) : "");

  const payload =
    tlv("00", "01") +
    tlv("01", amount ? "12" : "11") +
    tlv("26", merchant) +
    tlv("52", "0000") +
    tlv("53", "702") +
    (amount ? tlv("54", money(amount)) : "") +
    tlv("58", "SG") +
    // PayNow rejects a code with no merchant name; the city is required by the
    // standard and is not shown to the payer.
    tlv("59", merchantName.slice(0, 25) || "NA") +
    tlv("60", "Singapore");

  return seal(payload);
}

// ------------------------------------------------------------------ QRIS (ID)

/**
 * Putting an amount into a merchant QR the operator already has.
 *
 * Half of Asia pays on an EMVCo merchant code — QRIS in Indonesia, DuitNow in
 * Malaysia, QRPh in the Philippines, KHQR in Cambodia — and every one of them
 * is issued to the merchant by their bank or acquirer. Nobody else can
 * assemble one, and a code assembled from a guess is a customer whose money
 * goes nowhere.
 *
 * What an operator does have is the static code printed on their counter, and
 * turning that into one that names an amount is a defined transformation
 * rather than a guess: point-of-initiation becomes one-time, an amount field
 * is inserted in tag order, and the checksum is recomputed. That works for
 * every scheme above without this file knowing anything about any of them.
 *
 * `country` is checked when the caller names one, so an operator who pastes
 * their Thai code into the Indonesian method is told rather than handed a
 * broken QR.
 */
export function withAmount(staticPayload: string, amount: number, country?: string): string | null {
  const fields = parse(staticPayload.trim());
  if (!fields) return null;
  // Every EMVCo code opens with the format indicator.
  if (fields[0]?.tag !== "00" || fields[0].value !== "01") return null;
  if (!(amount > 0)) return null;

  if (country) {
    const declared = fields.find((f) => f.tag === "58")?.value?.toUpperCase();
    if (declared !== country.toUpperCase()) return null;
  }

  const next: Field[] = [];
  for (const field of fields) {
    if (field.tag === "63") continue;
    if (field.tag === "54") continue; // replaced below
    if (field.tag === "01") {
      next.push({ tag: "01", value: "12" });
      continue;
    }
    next.push(field);
  }

  // Tag order matters to some readers, so the amount goes where the standard
  // puts it rather than on the end.
  const at = next.findIndex((f) => Number(f.tag) > 54);
  const amountField: Field = { tag: "54", value: money(amount) };
  if (at < 0) next.push(amountField);
  else next.splice(at, 0, amountField);

  return build(next);
}

/** Indonesia's own name for the same thing, kept for the QRIS method. */
export function buildQris(staticPayload: string, amount: number): string | null {
  return withAmount(staticPayload, amount, "ID");
}

// ------------------------------------------------------------------- UPI (IN)

export type UpiInput = {
  /** The payee's virtual address, e.g. name@bank. */
  vpa: string;
  payeeName: string;
  amount?: number;
  /** What the payer sees, and what the operator reconciles against. */
  reference?: string;
};

/**
 * UPI is not EMVCo — it is a deep link, and the QR is that link encoded.
 *
 * The same string opens the payer's UPI app when tapped on a phone, which is
 * what most Indian customers will do rather than scan their own screen.
 */
export function buildUpi({ vpa, payeeName, amount, reference }: UpiInput): string | null {
  const address = vpa.trim();
  if (!/^[\w.\-]{2,}@[\w.\-]{2,}$/.test(address)) return null;

  const params = new URLSearchParams();
  params.set("pa", address);
  params.set("pn", payeeName.trim().slice(0, 50) || "Merchant");
  params.set("cu", "INR");
  if (amount && amount > 0) params.set("am", money(amount));
  if (reference) {
    // Both, because apps differ over which one they show the payer.
    params.set("tr", reference.slice(0, 35));
    params.set("tn", reference.slice(0, 50));
  }

  return `upi://pay?${params.toString()}`;
}
