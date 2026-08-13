import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { creditDeposit, failDeposit } from "./credit";
import { parseConfig } from "./index";

/**
 * Crypto gateway callback.
 *
 * The gateway signs the body with the IPN secret, so the signature is the only
 * thing that proves a payment — the body itself is attacker-controlled until
 * it checks out. Keys are sorted before hashing because that is the order the
 * gateway hashes them in.
 */

/** JSON with object keys in alphabetical order, at every depth. */
function sortedJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(sortedJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${sortedJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function signatureMatches(secret: string, body: unknown, provided: string): boolean {
  const expected = createHmac("sha512", secret).update(sortedJson(body)).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided.trim(), "utf8");
  // Length has to match before timingSafeEqual will look at the bytes.
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Statuses that mean the money has actually arrived. */
const PAID = new Set(["finished", "confirmed"]);
/** Statuses that end the attempt without money. */
const DEAD = new Set(["failed", "refunded", "expired"]);

export async function handleCryptoWebhook(request: Request) {
  const method = await db.paymentMethod.findFirst({ where: { driver: "crypto" } });
  if (!method || !method.enabled) {
    return NextResponse.json({ success: false, message: "Method disabled" }, { status: 404 });
  }

  const secret = parseConfig(method.config).ipnSecret?.trim();
  if (!secret) return NextResponse.json({ success: false, message: "Not configured" }, { status: 503 });

  // Read once as text: the signature covers these exact bytes.
  const raw = await request.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON" }, { status: 400 });
  }

  const provided = request.headers.get("x-nowpayments-sig") ?? "";
  if (!provided || !signatureMatches(secret, body, provided)) {
    return NextResponse.json({ success: false, message: "Bad signature" }, { status: 401 });
  }

  const reference = String(body.order_id ?? "").trim();
  const status = String(body.payment_status ?? "").toLowerCase();

  const config = parseConfig(method.config);
  const prefix = (config.prefix || "NOVA").replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "NOVA";
  const match = reference.toUpperCase().match(new RegExp(`^${prefix}(\\d{3,})$`));
  if (!match) return NextResponse.json({ success: false, message: "Unknown reference" }, { status: 202 });

  const txn = await db.transaction.findFirst({
    where: { publicId: Number(match[1]), type: "deposit", methodId: method.id },
  });
  if (!txn) return NextResponse.json({ success: false, message: "Unknown reference" }, { status: 202 });

  if (DEAD.has(status)) {
    await failDeposit(txn.id, `Crypto payment ${status}`);
    return NextResponse.json({ success: true, message: status });
  }
  if (!PAID.has(status)) {
    // Waiting, confirming, sending — real states, just not money yet.
    return NextResponse.json({ success: true, message: `ignored ${status || "unknown"}` });
  }

  // A part-paid invoice is not a paid one. Recorded rather than credited, so
  // an operator can settle it by hand.
  const paid = Number(body.actually_paid ?? body.pay_amount ?? 0);
  const owed = Number(body.pay_amount ?? 0);
  if (owed > 0 && paid > 0 && paid + 1e-8 < owed) {
    await db.transaction.update({
      where: { id: txn.id },
      data: { note: `Underpaid: received ${paid}, expected ${owed}` },
    });
    return NextResponse.json({ success: false, message: "Amount is lower than the invoice" }, { status: 202 });
  }

  const result = await creditDeposit(txn.id, String(body.payment_id ?? ""));
  return NextResponse.json({ success: true, message: result });
}
