import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { creditDeposit, failDeposit } from "./credit";
import { minorUnits, parseConfig } from "./index";

/**
 * Stripe callback — the half of the Link/card gateway that was missing.
 *
 * The driver opened a Checkout Session in `mode: "payment"` and sent the payer
 * to Stripe, and nothing ever heard back. Stripe charges the card the moment
 * the session completes, so the money left the customer's account and the
 * deposit sat `pending` until an operator noticed and approved it by hand. The
 * driver even asked the operator to configure a webhook signing secret that
 * nothing read.
 *
 * The signature is the whole of the authentication: Stripe posts from
 * addresses that change, over the open internet, and the body is
 * attacker-controlled until it verifies.
 */

/** How long a signed payload stays acceptable — Stripe's own default. */
const TOLERANCE_SECONDS = 300;

/**
 * `Stripe-Signature: t=1699999999,v1=abc...,v1=def...`
 *
 * More than one `v1` appears while a secret is being rotated, and any of them
 * matching is a pass. Anything that is not `t` or `v1` — `v0`, used only for
 * Connect — is ignored rather than trusted.
 */
function parseSignature(header: string): { timestamp: number; signatures: string[] } {
  let timestamp = 0;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key?.trim() === "t") timestamp = Number(value);
    else if (key?.trim() === "v1" && value) signatures.push(value.trim());
  }
  return { timestamp, signatures };
}

function signatureMatches(secret: string, timestamp: number, raw: string, provided: string[]): boolean {
  // Stripe signs "<timestamp>.<exact body bytes>", which is why the body is
  // read as text and never re-serialised.
  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  const a = Buffer.from(expected, "utf8");
  return provided.some((candidate) => {
    const b = Buffer.from(candidate, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

/**
 * The whole of the decision to trust a body, as one pure function.
 *
 * Split out of the handler so it can be exercised without a database or a
 * request: a bad secret, a body altered after signing, a signature captured
 * and replayed an hour later, and a header with nothing in it are the four
 * ways this is attacked, and each is one call.
 *
 * Returns null when the body may be trusted, or the reason it may not.
 */
export function stripeSignatureFault(
  header: string,
  raw: string,
  secret: string,
  nowMs = Date.now(),
): "missing" | "stale" | "mismatch" | null {
  const { timestamp, signatures } = parseSignature(header);
  if (!timestamp || signatures.length === 0) return "missing";
  if (Math.abs(nowMs / 1000 - timestamp) > TOLERANCE_SECONDS) return "stale";
  if (!signatureMatches(secret, timestamp, raw, signatures)) return "mismatch";
  return null;
}

type Session = {
  id?: string;
  client_reference_id?: string;
  payment_status?: string;
  amount_total?: number;
  currency?: string;
  payment_intent?: string;
};

/** Events that end the attempt without money. */
const DEAD = new Set(["checkout.session.expired", "checkout.session.async_payment_failed"]);

export async function handleStripeWebhook(request: Request) {
  const method = await db.paymentMethod.findFirst({ where: { driver: "link" } });
  if (!method || !method.enabled) {
    return NextResponse.json({ received: false, message: "Method disabled" }, { status: 404 });
  }

  const secret = parseConfig(method.config).webhookSecret?.trim();
  // Refusing rather than accepting: an unconfigured secret means nothing can
  // prove a payment, and crediting on an unproven claim is the whole problem.
  if (!secret) return NextResponse.json({ received: false, message: "Not configured" }, { status: 503 });

  const raw = await request.text();
  const header = request.headers.get("stripe-signature") ?? "";
  const { timestamp, signatures } = parseSignature(header);

  if (!timestamp || signatures.length === 0) {
    return NextResponse.json({ received: false, message: "Bad signature" }, { status: 401 });
  }
  // A signature stays valid for ever without this, so a body captured once
  // could be replayed for ever.
  if (Math.abs(Date.now() / 1000 - timestamp) > TOLERANCE_SECONDS) {
    return NextResponse.json({ received: false, message: "Signature too old" }, { status: 401 });
  }
  if (!signatureMatches(secret, timestamp, raw, signatures)) {
    return NextResponse.json({ received: false, message: "Bad signature" }, { status: 401 });
  }

  let event: { type?: string; data?: { object?: Session } };
  try {
    event = JSON.parse(raw) as typeof event;
  } catch {
    return NextResponse.json({ received: false, message: "Invalid JSON" }, { status: 400 });
  }

  const type = String(event.type ?? "");
  const session = event.data?.object ?? {};

  // `client_reference_id` is the transaction id the driver put there, so the
  // deposit is found without trusting anything else in the body.
  const transactionId = String(session.client_reference_id ?? "").trim();
  if (!transactionId) return NextResponse.json({ received: true, message: "No reference" });

  const txn = await db.transaction.findFirst({
    where: { id: transactionId, type: "deposit", methodId: method.id },
  });
  // 200, not an error: Stripe retries anything else for days, and a session
  // belonging to another panel is not a failure of this one.
  if (!txn) return NextResponse.json({ received: true, message: "Unknown reference" });

  if (DEAD.has(type)) {
    await failDeposit(txn.id, `Stripe session ${type.split(".").pop()}`);
    return NextResponse.json({ received: true, message: "failed" });
  }
  if (type !== "checkout.session.completed" && type !== "checkout.session.async_payment_succeeded") {
    return NextResponse.json({ received: true, message: `ignored ${type || "unknown"}` });
  }
  if (String(session.payment_status ?? "") !== "paid") {
    return NextResponse.json({ received: true, message: "not paid yet" });
  }

  // What Stripe says was taken, against what the panel asked for. Nothing
  // checked this before — the panel would have credited whatever arrived.
  const expected = await minorUnits(txn.paidAmount, txn.currency);
  const paid = Number(session.amount_total ?? 0);
  const sameCurrency = String(session.currency ?? "").toUpperCase() === txn.currency.toUpperCase();
  if (!sameCurrency || paid < expected) {
    await db.transaction.update({
      where: { id: txn.id },
      data: { note: `Underpaid: received ${paid} ${session.currency ?? "?"}, expected ${expected} ${txn.currency}` },
    });
    return NextResponse.json({ received: true, message: "Amount does not match" });
  }

  const result = await creditDeposit(txn.id, String(session.payment_intent ?? session.id ?? ""), {
    automatic: true,
  });
  return NextResponse.json({ received: true, message: result });
}
