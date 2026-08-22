import { drivers, parseConfig, type GatewayConfig } from "./index";

/**
 * "Test connection" — answering the one question an operator actually has.
 *
 * A gateway is configured on one screen and only fails on another, at the
 * moment a customer is trying to pay. The keys were pasted into the wrong two
 * boxes, or the sandbox key went into the live field, or the secret was
 * regenerated last month and nobody updated it here. None of that is visible
 * until someone loses a payment.
 *
 * So each method can be asked, from its own drawer, whether it currently
 * works. Where the gateway has an API, that means a real authenticated call
 * against it. Where there is none — the QR rails, the hosted-form wallets —
 * it means building exactly what a customer would be shown and reporting who
 * it pays, which is the failure that actually happens there: a code that
 * scans into somebody else's account, or into nothing.
 *
 * Everything decidable without the network lives in this half of the file and
 * is tested; the calls themselves are in the other half.
 */

export type Verdict = {
  ok: boolean;
  /** Dictionary key, worded by the caller, who knows the reader's language. */
  key: string;
  vars?: Record<string, string | number>;
};

/** Which required fields are still empty. */
export function missingFields(driverKey: string, config: GatewayConfig): string[] {
  const driver = drivers[driverKey];
  if (!driver) return [];
  return driver.required.filter((field) => !config[field]?.trim());
}

/**
 * What an HTTP status from a gateway means.
 *
 * The distinction that matters is between "your keys are wrong" and "they are
 * right but something else went wrong" — an operator told only "failed" will
 * change the keys that were already correct.
 */
export function verdictFromStatus(status: number): Verdict {
  if (status >= 200 && status < 300) return { ok: true, key: "probe.ok" };
  if (status === 401 || status === 403) return { ok: false, key: "probe.badKey" };
  // A 404 from an authenticated probe means the credentials were accepted and
  // the thing asked for does not exist, which is what some of these probes
  // deliberately ask for.
  if (status === 404) return { ok: true, key: "probe.okAuth" };
  if (status === 429) return { ok: false, key: "probe.rateLimited" };
  if (status >= 500) return { ok: false, key: "probe.gatewayDown", vars: { status } };
  return { ok: false, key: "probe.rejected", vars: { status } };
}

/**
 * A method whose rail takes only currencies this panel has never created.
 *
 * Nothing is wrong with the credentials; there is simply no currency a
 * customer could pay in, so the method can never be chosen. Worth catching
 * here because it looks exactly like a working method from every other angle.
 */
export function noCurrencyVerdict(missing: string[]): Verdict {
  return { ok: false, key: "probe.noCurrency", vars: { codes: missing.join(", ") } };
}

/** A method that cannot be tested because it has not been filled in. */
export function unconfiguredVerdict(missing: string[]): Verdict {
  return { ok: false, key: "probe.missing", vars: { fields: missing.join(", ") } };
}

/**
 * The drivers with nothing to call.
 *
 * A QR rail moves money between two bank accounts with no gateway in the
 * middle, and a hosted-form wallet is a form. There is no endpoint that could
 * say yes, so the test builds the very thing a customer would be handed and
 * reports what it addresses.
 */
export const OFFLINE_DRIVERS = new Set([
  "promptpay",
  "paynow",
  "qris",
  "upi",
  "merchantqr",
  "manual",
  "payeer",
  "perfectmoney",
  "coinpayments",
  "momo",
  "zalopay",
  "viettelpay",
  "seapay",
]);

/** Whether this driver is tested by building something rather than by calling. */
export function isOffline(driverKey: string): boolean {
  return OFFLINE_DRIVERS.has(driverKey);
}

/**
 * The offline test: build what the customer would see, at a sample amount.
 *
 * The amount is arbitrary and never charged — it exists because most of these
 * payloads only take their final shape once they carry one.
 */
export const SAMPLE_AMOUNT = 100;

export async function probeOffline(driverKey: string, config: GatewayConfig): Promise<Verdict> {
  const missing = missingFields(driverKey, config);
  if (missing.length > 0) return unconfiguredVerdict(missing);

  const { buildPayNow, buildPromptPay, buildQris, buildUpi, withAmount, promptPayTarget } = await import("./asia-qr");

  switch (driverKey) {
    case "promptpay": {
      const target = promptPayTarget(config.target);
      if (!target || !buildPromptPay({ target: config.target, amount: SAMPLE_AMOUNT })) {
        return { ok: false, key: "probe.badTarget" };
      }
      return { ok: true, key: "probe.paysTo", vars: { payee: target.value } };
    }
    case "paynow": {
      const payload = buildPayNow({
        proxyType: config.proxyType === "uen" ? "uen" : "mobile",
        proxy: config.proxy,
        merchantName: config.merchantName,
        amount: SAMPLE_AMOUNT,
      });
      if (!payload) return { ok: false, key: "probe.badTarget" };
      return { ok: true, key: "probe.paysTo", vars: { payee: config.proxy } };
    }
    case "qris": {
      if (!buildQris(config.staticPayload, SAMPLE_AMOUNT)) return { ok: false, key: "probe.badCode" };
      return { ok: true, key: "probe.codeReady" };
    }
    case "merchantqr": {
      if (!withAmount(config.staticPayload, SAMPLE_AMOUNT, config.country?.trim() || undefined)) {
        return { ok: false, key: "probe.badCode" };
      }
      return { ok: true, key: "probe.codeReady" };
    }
    case "upi": {
      if (!buildUpi({ vpa: config.vpa, payeeName: config.payeeName, amount: SAMPLE_AMOUNT })) {
        return { ok: false, key: "probe.badTarget" };
      }
      return { ok: true, key: "probe.paysTo", vars: { payee: config.vpa } };
    }
    case "seapay": {
      const { VIETQR_BANKS, buildVietQrPayload } = await import("./vietqr");
      const bank = (config.bankCode || "MB").toUpperCase();
      if (!VIETQR_BANKS[bank]) return { ok: false, key: "probe.badBank", vars: { bank } };
      try {
        buildVietQrPayload({ bankCode: bank, accountNumber: config.accountNumber, amount: SAMPLE_AMOUNT });
      } catch {
        return { ok: false, key: "probe.badCode" };
      }
      return { ok: true, key: "probe.paysTo", vars: { payee: `${config.accountNumber} · ${VIETQR_BANKS[bank].name}` } };
    }
    case "perfectmoney": {
      if (!/^U\d{5,}$/i.test(config.payeeAccount.trim())) return { ok: false, key: "probe.badAccount" };
      return { ok: true, key: "probe.paysTo", vars: { payee: config.payeeAccount.trim().toUpperCase() } };
    }
    default:
      // Everything else offline is a form or a manual transfer: filled in is
      // as much as can honestly be said.
      return { ok: true, key: "probe.filledIn" };
  }
}

/** Reads a method row and decides what to say without touching the network. */
export function offlineOrOnline(driverKey: string, rawConfig: string): { config: GatewayConfig; offline: boolean } {
  return { config: parseConfig(rawConfig), offline: isOffline(driverKey) };
}
