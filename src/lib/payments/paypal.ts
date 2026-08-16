import type { GatewayConfig } from "./index";

/**
 * The PayPal calls shared by the driver, the return page and the webhook.
 *
 * The driver used to hold all of this inline, and it only ever went one way:
 * it created an order with `intent: "CAPTURE"` and sent the payer off to
 * approve it. Approving an order does not move any money — capturing it does —
 * and nothing ever called capture. Every PayPal deposit ended with the
 * customer believing they had paid and the panel holding a `pending` row.
 */

/**
 * Overridable, the same way `rank.apiBase` is: a capture cannot be proved to
 * work against the real PayPal without a real payer, so the whole path is
 * pointable at a stand-in. Left blank — which is how every panel ships — it is
 * the live or sandbox host and nothing else.
 */
export function apiBase(config: GatewayConfig): string {
  const override = config.apiUrl?.trim().replace(/\/+$/, "");
  if (override) return override;
  return config.mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

export async function accessToken(config: GatewayConfig): Promise<string | null> {
  const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const res = await fetch(`${apiBase(config)}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { access_token?: string };
  return body.access_token ?? null;
}

export type CaptureResult =
  | { ok: true; captureId: string; amount: number; currency: string }
  | { ok: false; reason: string; alreadyCaptured?: true };

/**
 * Takes the money the payer approved.
 *
 * `ORDER_ALREADY_CAPTURED` is reported as its own outcome rather than as a
 * failure: the return page and the webhook race each other by design, and
 * whichever arrives second must not look like something went wrong.
 */
export async function captureOrder(config: GatewayConfig, orderId: string): Promise<CaptureResult> {
  const token = await accessToken(config);
  if (!token) return { ok: false, reason: "PayPal credentials were refused" };

  const res = await fetch(`${apiBase(config)}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      // PayPal keys retries on this, so a double submit captures once.
      "PayPal-Request-Id": `capture-${orderId}`,
    },
    cache: "no-store",
  });

  const body = (await res.json().catch(() => ({}))) as {
    status?: string;
    details?: { issue?: string }[];
    purchase_units?: {
      payments?: { captures?: { id?: string; status?: string; amount?: { value?: string; currency_code?: string } }[] };
    }[];
  };

  if (!res.ok) {
    const issue = body.details?.[0]?.issue ?? `HTTP ${res.status}`;
    if (issue === "ORDER_ALREADY_CAPTURED") return { ok: false, reason: issue, alreadyCaptured: true };
    return { ok: false, reason: issue };
  }

  const capture = body.purchase_units?.[0]?.payments?.captures?.[0];
  if (!capture || capture.status !== "COMPLETED") {
    return { ok: false, reason: `Capture status ${capture?.status ?? body.status ?? "unknown"}` };
  }

  return {
    ok: true,
    captureId: String(capture.id ?? ""),
    amount: Number(capture.amount?.value ?? 0),
    currency: String(capture.amount?.currency_code ?? ""),
  };
}

/**
 * Asks PayPal whether it really sent this.
 *
 * PayPal does not sign with a shared secret the way the other gateways do —
 * the signature is over a certificate chain, and the supported way to check it
 * is to hand the headers back to PayPal and be told. That needs the webhook's
 * own id, which the operator copies from their dashboard; without it nothing
 * can be proven and the handler refuses rather than trusting the body.
 */
export async function verifyWebhook(
  config: GatewayConfig,
  headers: Headers,
  rawBody: string,
): Promise<boolean> {
  const webhookId = config.webhookId?.trim();
  if (!webhookId) return false;

  const token = await accessToken(config);
  if (!token) return false;

  const required = [
    "paypal-auth-algo",
    "paypal-cert-url",
    "paypal-transmission-id",
    "paypal-transmission-sig",
    "paypal-transmission-time",
  ] as const;
  const present = required.map((h) => headers.get(h));
  if (present.some((v) => !v)) return false;

  const res = await fetch(`${apiBase(config)}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      auth_algo: present[0],
      cert_url: present[1],
      transmission_id: present[2],
      transmission_sig: present[3],
      transmission_time: present[4],
      webhook_id: webhookId,
      // The event has to go back as parsed JSON, not as the raw string.
      webhook_event: JSON.parse(rawBody) as unknown,
    }),
  });
  if (!res.ok) return false;
  const body = (await res.json()) as { verification_status?: string };
  return body.verification_status === "SUCCESS";
}
