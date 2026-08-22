import { parseConfig, type GatewayConfig } from "./index";
import { drivers } from "./index";
import { missingCurrencies, offerableCurrencies } from "./currencies";
import {
  isOffline,
  missingFields,
  noCurrencyVerdict,
  probeOffline,
  unconfiguredVerdict,
  verdictFromStatus,
  type Verdict,
} from "./probe";

/**
 * The calls behind "Test connection".
 *
 * Each is the cheapest authenticated request the gateway offers — a balance, a
 * list of one, a certificate fetch. None of them creates anything, takes any
 * money, or leaves a record an operator would have to tidy up afterwards, and
 * every one goes through the same short timeout, because a gateway that hangs
 * is a gateway that is down as far as this button is concerned.
 *
 * Where a probe deliberately asks for something that does not exist, a 404 is
 * the *success*: it means the credentials were read and accepted. That is what
 * distinguishes "your key is wrong" from "your key is fine".
 */

const TIMEOUT_MS = 12_000;

/** One request, turned into a verdict. Network failures are not exceptions here. */
async function call(url: string, init: RequestInit = {}): Promise<Verdict> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    return verdictFromStatus(res.status);
  } catch (error) {
    // Aborted, DNS failure, refused connection, TLS error — from the
    // operator's side these are all "it could not be reached".
    const detail = error instanceof Error ? error.name : "";
    return { ok: false, key: "probe.unreachable", vars: detail ? { detail } : undefined };
  } finally {
    clearTimeout(timer);
  }
}

const basic = (user: string, pass = "") => `Basic ${Buffer.from(`${user}:${pass}`, "utf8").toString("base64")}`;

/** One probe per gateway that has something to answer. */
const PROBES: Record<string, (config: GatewayConfig) => Promise<Verdict>> = {
  async paypal(config) {
    const host = config.sandbox === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
    return call(`${host}/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: basic(config.clientId, config.clientSecret), "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
  },

  async link(config) {
    return call("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${config.secretKey}` } });
  },

  async crypto(config) {
    const base = (config.apiUrl || "https://api.nowpayments.io/v1").replace(/\/$/, "");
    // Their auth check: right key answers 200, wrong key answers 401.
    return call(`${base}/status`, { headers: { "x-api-key": config.apiKey } });
  },

  async cryptomus(config) {
    const { cryptomusSign } = await import("./gateway-signing");
    const body = JSON.stringify({});
    return call("https://api.cryptomus.com/v1/balance", {
      method: "POST",
      headers: { merchant: config.merchantId, sign: cryptomusSign(body, config.apiKey), "Content-Type": "application/json" },
      body,
    });
  },

  async binancepay(config) {
    const { binancePaySign } = await import("./gateway-signing");
    const { randomBytes } = await import("crypto");
    const body = JSON.stringify({});
    const timestamp = String(Date.now());
    const nonce = randomBytes(16).toString("hex");
    return call("https://bpay.binanceapi.com/binancepay/openapi/certificates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "BinancePay-Timestamp": timestamp,
        "BinancePay-Nonce": nonce,
        "BinancePay-Certificate-SN": config.apiKey,
        "BinancePay-Signature": binancePaySign({ timestamp, nonce, body, secret: config.apiSecret }),
      },
      body,
    });
  },

  async coinbase(config) {
    return call("https://api.commerce.coinbase.com/charges?limit=1", {
      headers: { "X-CC-Api-Key": config.apiKey, "X-CC-Version": "2018-03-22" },
    });
  },

  async oxapay(config) {
    return call("https://api.oxapay.com/merchants/allowedCoins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchant: config.merchantApiKey }),
    });
  },

  async razorpay(config) {
    return call("https://api.razorpay.com/v1/payments?count=1", {
      headers: { Authorization: basic(config.keyId, config.keySecret) },
    });
  },

  async midtrans(config) {
    const host = config.sandbox === "sandbox" ? "https://api.sandbox.midtrans.com" : "https://api.midtrans.com";
    // A status lookup for an order that does not exist: a wrong server key is
    // refused before the order is looked for, a right one gets a 404.
    return call(`${host}/v2/nova-connection-test/status`, { headers: { Authorization: basic(config.serverKey) } });
  },

  async xendit(config) {
    return call("https://api.xendit.co/balance", { headers: { Authorization: basic(config.secretKey) } });
  },

  async payos(config) {
    // Same idea: an order number nothing could be under.
    return call("https://api-merchant.payos.vn/v2/payment-requests/999999999", {
      headers: { "x-client-id": config.clientId, "x-api-key": config.apiKey },
    });
  },
};

/**
 * Tests one method, however it can be tested.
 *
 * The stored configuration is what is tested, never anything from the form:
 * secrets do not leave the server, and the answer has to be about what a
 * customer would actually meet.
 */
export async function probeMethod(driverKey: string, rawConfig: string, panelCurrencies: readonly string[] = []): Promise<Verdict> {
  const config = parseConfig(rawConfig);

  // A rail whose every currency is missing can never be chosen by anyone, and
  // it looks perfectly healthy from every other angle.
  const rail = drivers[driverKey]?.currencies;
  if (panelCurrencies.length > 0 && offerableCurrencies(rail, panelCurrencies).length === 0) {
    return noCurrencyVerdict(missingCurrencies(rail, panelCurrencies));
  }

  if (isOffline(driverKey)) return probeOffline(driverKey, config);

  const missing = missingFields(driverKey, config);
  if (missing.length > 0) return unconfiguredVerdict(missing);

  const probe = PROBES[driverKey];
  if (!probe) return { ok: true, key: "probe.filledIn" };
  return probe(config);
}
