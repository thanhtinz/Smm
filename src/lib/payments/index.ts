import { db } from "@/lib/db";

export type GatewayConfig = Record<string, string>;

export type DepositContext = {
  /** Amount in the payment currency, already fee-adjusted. */
  amount: number;
  currency: string;
  /** Short reference the payer must include, e.g. NOVA100042. */
  reference: string;
  transactionId: string;
  /** The deposit's own number, which is what a callback is matched back to. */
  publicId: number;
  /** Selects this panel in a callback URL, the way the webhook routes do. */
  panelToken: string;
  config: GatewayConfig;
  appUrl: string;
};

export type DepositInstruction =
  | { kind: "transfer"; bankName: string; accountNumber: string; accountName: string; reference: string; qrPayload?: string }
  | { kind: "redirect"; url: string }
  | { kind: "manual"; instructions: string; reference: string }
  // Why the gateway could not be reached — worded by the wallet page, which
  // knows the customer's language. A driver does not.
  | { kind: "unconfigured"; key: string };

export type Driver = {
  key: string;
  /**
   * Path segment of the callback this driver listens on, when it has one.
   * Drives what the admin page tells an operator to configure at the gateway.
   */
  webhook?: string;
  /**
   * The only currencies this gateway can actually take, when it is limited to
   * some. SePay, MoMo and ZaloPay are domestic Vietnamese rails: their APIs
   * take a whole number of dong, and the drivers round to one. An operator
   * could tick USD onto them in admin, at which point a $10.50 deposit was
   * asking the gateway for 11 of something. Left undefined the operator
   * chooses freely, which is right for the card and crypto gateways.
   */
  currencies?: string[];
  /** Which config fields must be non-empty for the method to be usable. */
  required: string[];
  /** Fields shown in the admin editor, in order. */
  fields: { name: string; label: string; type?: "text" | "password" | "select"; options?: string[]; hint?: string }[];
  prepare: (ctx: DepositContext) => Promise<DepositInstruction>;
};

export const drivers: Record<string, Driver> = {
  seapay: {
    key: "seapay",
    webhook: "seapay",
    currencies: ["VND"],
    required: ["accountNumber", "bankCode", "accountName"],
    fields: [
      { name: "accountNumber", label: "Account number" },
      { name: "bankCode", label: "Bank", type: "select", options: [] },
      { name: "accountName", label: "Account holder" },
      { name: "prefix", label: "Reference prefix", hint: "Prepended to the transfer content, e.g. NOVA" },
      { name: "apiToken", label: "SePay API token", type: "password" },
      { name: "webhookSecret", label: "Webhook secret", type: "password", hint: "Sent as Authorization: Apikey <secret>" },
    ],
    async prepare(ctx) {
      const { buildVietQrPayload, VIETQR_BANKS } = await import("./vietqr");
      const bankCode = (ctx.config.bankCode || "MB").toUpperCase();
      const bank = VIETQR_BANKS[bankCode];
      return {
        kind: "transfer",
        bankName: bank?.name ?? bankCode,
        accountNumber: ctx.config.accountNumber,
        accountName: ctx.config.accountName,
        reference: ctx.reference,
        qrPayload: buildVietQrPayload({
          bankCode,
          accountNumber: ctx.config.accountNumber,
          amount: Math.round(ctx.amount),
          description: ctx.reference,
        }),
      };
    },
  },

  paypal: {
    key: "paypal",
    webhook: "paypal",
    required: ["clientId", "clientSecret"],
    fields: [
      { name: "clientId", label: "Client ID" },
      { name: "clientSecret", label: "Client secret", type: "password" },
      { name: "mode", label: "Mode", type: "select", options: ["sandbox", "live"] },
      { name: "apiUrl", label: "API base", hint: "Leave blank for PayPal. Set only to point at a stand-in." },
      {
        name: "webhookId",
        label: "Webhook ID",
        hint: "From the PayPal dashboard. Without it the callback cannot be verified and is refused — the return page still captures.",
      },
    ],
    async prepare(ctx) {
      const base = ctx.config.mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
      const auth = Buffer.from(`${ctx.config.clientId}:${ctx.config.clientSecret}`).toString("base64");

      const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=client_credentials",
      });
      if (!tokenRes.ok) return { kind: "unconfigured", key: "err.payPaypalAuth" };
      const { access_token } = (await tokenRes.json()) as { access_token: string };

      const orderRes = await fetch(`${base}/v2/checkout/orders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              custom_id: ctx.transactionId,
              invoice_id: ctx.reference,
              amount: { currency_code: ctx.currency, value: ctx.amount.toFixed(2) },
            },
          ],
          application_context: {
            return_url: `${ctx.appUrl}/dashboard/wallet/${ctx.transactionId}?paypal=return`,
            cancel_url: `${ctx.appUrl}/dashboard/wallet/${ctx.transactionId}?paypal=cancel`,
          },
        }),
      });
      if (!orderRes.ok) return { kind: "unconfigured", key: "err.payPaypalOrder" };
      const order = (await orderRes.json()) as { links?: { rel: string; href: string }[] };
      const approve = order.links?.find((l) => l.rel === "approve" || l.rel === "payer-action");
      if (!approve) return { kind: "unconfigured", key: "err.payPaypalLink" };
      return { kind: "redirect", url: approve.href };
    },
  },

  crypto: {
    key: "crypto",
    webhook: "crypto",
    required: ["apiKey", "ipnSecret"],
    fields: [
      { name: "apiKey", label: "API key", type: "password" },
      { name: "ipnSecret", label: "IPN secret", type: "password", hint: "Signs the callback, so it is what proves a payment" },
      { name: "payCurrency", label: "Coin", hint: "Leave blank to let the payer choose, or set one, e.g. usdttrc20" },
      {
        name: "apiUrl",
        label: "API base URL",
        hint: "NOWPayments by default; any service with the same invoice API works",
      },
    ],
    async prepare(ctx) {
      const base = (ctx.config.apiUrl || "https://api.nowpayments.io/v1").replace(/\/$/, "");

      const res = await fetch(`${base}/invoice`, {
        method: "POST",
        headers: { "x-api-key": ctx.config.apiKey, "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          price_amount: ctx.amount,
          price_currency: ctx.currency.toLowerCase(),
          ...(ctx.config.payCurrency ? { pay_currency: ctx.config.payCurrency } : {}),
          // The reference is what the callback is matched back to, so it has
          // to be the order id rather than anything cosmetic.
          order_id: ctx.reference,
          order_description: `Balance top-up ${ctx.reference}`,
          ipn_callback_url: `${ctx.appUrl}/api/webhooks/crypto`,
          success_url: `${ctx.appUrl}/dashboard/wallet/${ctx.transactionId}?crypto=success`,
          cancel_url: `${ctx.appUrl}/dashboard/wallet/${ctx.transactionId}?crypto=cancel`,
        }),
      });

      if (!res.ok) {
        return { kind: "unconfigured", key: "err.payCryptoAuth" };
      }

      const data = (await res.json()) as { invoice_url?: string };
      if (!data.invoice_url) return { kind: "unconfigured", key: "err.payCryptoInvoice" };
      return { kind: "redirect", url: data.invoice_url };
    },
  },

  momo: {
    key: "momo",
    webhook: "momo",
    currencies: ["VND"],
    required: ["partnerCode", "accessKey", "secretKey"],
    fields: [
      { name: "partnerCode", label: "Partner code" },
      { name: "accessKey", label: "Access key", type: "password" },
      { name: "secretKey", label: "Secret key", type: "password", hint: "Signs both the order and the callback" },
      {
        name: "apiUrl",
        label: "API endpoint",
        hint: "Leave blank for live. The test gateway is https://test-payment.momo.vn/v2/gateway/api/create",
      },
    ],
    async prepare(ctx) {
      const { signCreate } = await import("./momo");
      const endpoint = ctx.config.apiUrl || "https://payment.momo.vn/v2/gateway/api/create";

      // MoMo takes whole dong, and rounds nothing itself: a fractional amount
      // is rejected outright rather than adjusted.
      const values = {
        accessKey: ctx.config.accessKey,
        amount: String(Math.round(ctx.amount)),
        extraData: "",
        ipnUrl: `${ctx.appUrl}/api/webhooks/${ctx.panelToken}/momo`,
        // The reference is what the callback is matched back to, so it is the
        // deposit's own id rather than anything cosmetic.
        orderId: ctx.reference,
        orderInfo: `Nap tien ${ctx.reference}`,
        partnerCode: ctx.config.partnerCode,
        redirectUrl: `${ctx.appUrl}/dashboard/wallet/${ctx.transactionId}?momo=return`,
        requestId: ctx.reference,
        requestType: ctx.config.requestType || "captureWallet",
      };

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            ...values,
            // Signed but not sent: it is a shared secret, not a parameter.
            accessKey: undefined,
            partnerName: ctx.config.partnerName || "Nova",
            storeId: ctx.config.partnerCode,
            lang: "vi",
            signature: signCreate(values, ctx.config.secretKey),
          }),
        });
        const data = (await res.json()) as { payUrl?: string; resultCode?: number };
        if (!data.payUrl) return { kind: "unconfigured", key: "err.payMomo" };
        return { kind: "redirect", url: data.payUrl };
      } catch {
        return { kind: "unconfigured", key: "err.payUnreachable" };
      }
    },
  },

  zalopay: {
    key: "zalopay",
    webhook: "zalopay",
    currencies: ["VND"],
    required: ["appId", "key1", "key2"],
    fields: [
      { name: "appId", label: "App ID" },
      { name: "key1", label: "Key 1", type: "password", hint: "Signs the order this panel sends" },
      { name: "key2", label: "Key 2", type: "password", hint: "Signs the callback the panel receives" },
      {
        name: "apiUrl",
        label: "API endpoint",
        hint: "Leave blank for live. The sandbox is https://sb-openapi.zalopay.vn/v2/create",
      },
    ],
    async prepare(ctx) {
      const { signOrder, appTransId } = await import("./zalopay");
      const endpoint = ctx.config.apiUrl || "https://openapi.zalopay.vn/v2/create";

      const order = {
        app_id: ctx.config.appId,
        // Must start with yymmdd and be unique that day; the deposit's own id
        // supplies the uniqueness and makes the callback matchable.
        app_trans_id: appTransId(ctx.publicId, new Date()),
        app_user: ctx.reference,
        amount: Math.round(ctx.amount),
        app_time: Date.now(),
        embed_data: JSON.stringify({ redirecturl: `${ctx.appUrl}/dashboard/wallet/${ctx.transactionId}?zalopay=return` }),
        item: "[]",
      };

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          cache: "no-store",
          body: new URLSearchParams({
            ...Object.fromEntries(Object.entries(order).map(([k, v]) => [k, String(v)])),
            description: `Nap tien ${ctx.reference}`,
            callback_url: `${ctx.appUrl}/api/webhooks/${ctx.panelToken}/zalopay`,
            mac: signOrder(order, ctx.config.key1),
          }),
        });
        const data = (await res.json()) as { order_url?: string; return_code?: number; return_message?: string };
        if (!data.order_url) return { kind: "unconfigured", key: "err.payZalopay" };
        return { kind: "redirect", url: data.order_url };
      } catch {
        return { kind: "unconfigured", key: "err.payUnreachable" };
      }
    },
  },

  viettelpay: {
    key: "viettelpay",
    webhook: "viettelpay",
    currencies: ["VND"],
    required: ["merchantCode", "secretKey"],
    fields: [
      { name: "merchantCode", label: "Merchant code" },
      { name: "secretKey", label: "Secret key", type: "password", hint: "Signs both the order and the callback" },
      {
        name: "apiUrl",
        label: "API endpoint",
        hint: "Leave blank for live. Sandbox: https://sandbox.viettelpay.vn/payment/v1/create-order",
      },
    ],
    async prepare(ctx) {
      const { signOrder } = await import("./viettelpay");
      const endpoint = ctx.config.apiUrl || "https://sandbox.viettelpay.vn/payment/v1/create-order";

      const values = {
        merchant_code: ctx.config.merchantCode,
        order_id: ctx.reference,
        amount: String(Math.round(ctx.amount)),
        currency: "VND",
        order_desc: `Nap tien ${ctx.reference}`,
        return_url: `${ctx.appUrl}/dashboard/wallet/${ctx.transactionId}?viettelpay=return`,
        notify_url: `${ctx.appUrl}/api/webhooks/${ctx.panelToken}/viettelpay`,
        version: "2.0",
      };

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            ...values,
            check_sum: signOrder(values, ctx.config.secretKey),
          }),
        });
        const data = (await res.json()) as { checkout_url?: string; payment_url?: string; error_code?: string };
        const url = data.checkout_url ?? data.payment_url;
        if (!url) return { kind: "unconfigured", key: "err.payViettelpay" };
        return { kind: "redirect", url };
      } catch {
        return { kind: "unconfigured", key: "err.payUnreachable" };
      }
    },
  },

  link: {
    key: "link",
    webhook: "stripe",
    required: ["secretKey"],
    fields: [
      { name: "publishableKey", label: "Publishable key" },
      { name: "secretKey", label: "Secret key", type: "password" },
      { name: "webhookSecret", label: "Webhook signing secret", type: "password", hint: "Stripe signs every callback with this; without it the callback is refused." },
    ],
    async prepare(ctx) {
      // Link is Stripe's one-click wallet; a Checkout Session with `link`
      // enabled covers Link, cards and the local wallets Stripe offers.
      const body = new URLSearchParams({
        mode: "payment",
        success_url: `${ctx.appUrl}/dashboard/wallet/${ctx.transactionId}?stripe=success`,
        cancel_url: `${ctx.appUrl}/dashboard/wallet/${ctx.transactionId}?stripe=cancel`,
        client_reference_id: ctx.transactionId,
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": ctx.currency.toLowerCase(),
        "line_items[0][price_data][unit_amount]": String(await minorUnits(ctx.amount, ctx.currency)),
        "line_items[0][price_data][product_data][name]": `Balance top-up ${ctx.reference}`,
        "payment_method_types[0]": "card",
        "payment_method_types[1]": "link",
      });

      const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ctx.config.secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      if (!res.ok) return { kind: "unconfigured", key: "err.payStripeAuth" };
      const session = (await res.json()) as { url?: string };
      if (!session.url) return { kind: "unconfigured", key: "err.payStripeLink" };
      return { kind: "redirect", url: session.url };
    },
  },

  manual: {
    key: "manual",
    required: ["accountNumber", "accountName", "bankName"],
    fields: [
      { name: "bankName", label: "Bank name" },
      { name: "accountNumber", label: "Account number" },
      { name: "accountName", label: "Account holder" },
      { name: "instructions", label: "Instructions shown to the payer" },
    ],
    async prepare(ctx) {
      return {
        kind: "manual",
        instructions: ctx.config.instructions || "Transfer the exact amount and include the reference below.",
        reference: ctx.reference,
      };
    },
  },
};

export function parseConfig(raw: string): GatewayConfig {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: GatewayConfig = {};
    for (const [k, v] of Object.entries(parsed)) out[k] = v == null ? "" : String(v);
    return out;
  } catch {
    return {};
  }
}

export function parseCurrencies(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * What a method may actually be paid in.
 *
 * An empty stored list means "whatever the panel offers", which is the right
 * default for a card gateway and the wrong one for a domestic rail. Unticking
 * every box on MoMo, ZaloPay or SePay turned "dong only" into "anything" — and
 * those three drivers round the amount to whole units, because the dong has
 * none. A $25.50 deposit would have been handed to the gateway as 26.
 *
 * So a driver that declares its currencies is never unrestricted: an empty
 * choice falls back to what it can take rather than to everything, and a
 * stored list from before that restriction existed is narrowed on the way out.
 */
export function methodCurrencies(driverKey: string, stored: string): string[] {
  const chosen = parseCurrencies(stored);
  const allowed = drivers[driverKey]?.currencies;
  if (!allowed) return chosen;
  return chosen.length === 0 ? [...allowed] : chosen.filter((code) => allowed.includes(code));
}

/**
 * An amount in the currency's smallest unit, which is what card gateways
 * charge in and what their callbacks report.
 *
 * Not `amount * 100`. That is right for the dollar and wrong for every
 * currency without a subunit — the dong, the rupiah, the naira — where the
 * smallest unit *is* the unit. Charging `Math.round(amount * 100)` for a
 * 250,000 ₫ deposit asks Stripe for 25,000,000 ₫.
 */
export async function minorUnits(amount: number, currencyCode: string): Promise<number> {
  const { resolveCurrency } = await import("@/lib/currency");
  const currency = await resolveCurrency(currencyCode);
  return Math.round(amount * 10 ** currency.decimals);
}

/**
 * Whether a gateway reported less money than the deposit asked for.
 *
 * The slack is half of the currency's smallest unit — enough to absorb a
 * float, and nothing more. It used to be a flat `+ 1`, which cost nothing
 * while every one of these methods was dong-only: one dong of slack on a
 * 200,000 ₫ transfer is not slack at all. But an admin can tick USD onto
 * SePay, MoMo or ZaloPay, and one *dollar* of slack meant a $10.00 deposit
 * was credited in full when the gateway reported $9.01.
 */
export async function underpaid(received: number, owed: number, currencyCode: string): Promise<boolean> {
  const { resolveCurrency } = await import("@/lib/currency");
  const currency = await resolveCurrency(currencyCode);
  return received + 0.5 / 10 ** currency.decimals < owed;
}

/** A method is only offered once every credential its driver needs is filled. */
export function isConfigured(driverKey: string, config: GatewayConfig): boolean {
  const driver = drivers[driverKey];
  if (!driver) return false;
  return driver.required.every((field) => Boolean(config[field]?.trim()));
}

export async function getAvailableMethods() {
  const rows = await db.paymentMethod.findMany({ where: { enabled: true }, orderBy: { position: "asc" } });
  return rows.map((row) => {
    const config = parseConfig(row.config);
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      driver: row.driver,
      icon: row.icon,
      description: row.description,
      currencies: methodCurrencies(row.driver, row.currencies),
      minAmount: row.minAmount,
      maxAmount: row.maxAmount,
      feePercent: row.feePercent,
      feeFixed: row.feeFixed,
      bonusPercent: row.bonusPercent,
      configured: isConfigured(row.driver, config),
    };
  });
}

export type AvailableMethod = Awaited<ReturnType<typeof getAvailableMethods>>[number];

/** Gateway fees are added on top: the panel credits the requested amount. */
export function computeTotals(amount: number, method: { feePercent: number; feeFixed: number; bonusPercent: number }) {
  const fee = Math.max(0, (amount * method.feePercent) / 100 + method.feeFixed);
  const bonus = Math.max(0, (amount * method.bonusPercent) / 100);
  return { fee, bonus, payable: amount + fee, credited: amount + bonus };
}
