import { createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";

/**
 * Time-based one-time passwords, RFC 6238.
 *
 * Written out rather than pulled in: it is HMAC-SHA1 over a counter plus a
 * base32 alphabet, all of which node already has, and a dependency in the
 * sign-in path is a dependency that can lock every admin out of the panel.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const DIGITS = 6;
const PERIOD = 30;

/**
 * How many steps either side of now are accepted. One covers a clock a few
 * seconds out and a code typed as it rolls over; more than that widens the
 * window a stolen code stays usable in.
 */
const DRIFT = 1;

export function generateSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    value = (value << 5) | ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function codeAt(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac("sha1", key).update(message).digest();
  // Dynamic truncation: the low nibble of the last byte picks where to read.
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];

  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/** The code an app would be showing right now. Exposed for tests and setup. */
export function currentCode(secret: string, at = Date.now()): string {
  return codeAt(secret, Math.floor(at / 1000 / PERIOD));
}

export function verifyCode(secret: string, submitted: string, at = Date.now()): boolean {
  const cleaned = submitted.replace(/\D/g, "");
  if (cleaned.length !== DIGITS || !secret) return false;

  const step = Math.floor(at / 1000 / PERIOD);
  for (let drift = -DRIFT; drift <= DRIFT; drift++) {
    // Constant time, so the answer does not leak which digits were right.
    if (equals(codeAt(secret, step + drift), cleaned)) return true;
  }
  return false;
}

function equals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** The URI an authenticator app reads out of the QR code. */
export function otpauthUrl(secret: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const query = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD),
  });
  return `otpauth://totp/${label}?${query}`;
}

/**
 * Recovery codes, the way back in when the phone is gone. Ten of them, each
 * good once — enough to survive a few panics without becoming a second
 * password list worth stealing.
 */
export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () =>
    `${randomInt(0, 1e5).toString().padStart(5, "0")}-${randomInt(0, 1e5).toString().padStart(5, "0")}`,
  );
}

/** Codes are compared with the dash and spacing thrown away. */
export function normaliseRecoveryCode(raw: string): string {
  return raw.replace(/\D/g, "");
}
