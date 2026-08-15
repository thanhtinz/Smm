import { cache } from "react";
import { db } from "./db";
import { currentPanelId } from "./tenancy";

/**
 * Every runtime-configurable value of the panel. Defaults live here, the
 * persisted override lives in the Setting table and is edited from the admin
 * area only — nothing below is meant to be changed by editing source files.
 */
export const settingDefinitions = {
  // --- Branding -----------------------------------------------------------
  "site.name": { group: "branding", type: "text", value: "Nova Panel" },
  "site.tagline": { group: "branding", type: "text", value: "Social media growth, delivered" },
  "site.description": {
    group: "branding",
    type: "textarea",
    value: "The fastest SMM panel to grow your social presence with reliable, automated delivery.",
  },
  "site.logoText": { group: "branding", type: "text", value: "Nova" },
  // Uploaded rather than pasted: an operator with a logo file should not have
  // to find somewhere to host it first.
  "site.logoUrl": { group: "branding", type: "image", value: "" },
  "site.faviconUrl": { group: "branding", type: "image", value: "" },
  "site.supportEmail": { group: "branding", type: "text", value: "support@novapanel.io" },
  "site.telegram": { group: "branding", type: "text", value: "" },
  // Zalo is how this market actually reaches support; a phone number or a
  // zalo.me link both work.
  "site.zalo": { group: "branding", type: "text", value: "" },
  "site.whatsapp": { group: "branding", type: "text", value: "" },
  "site.facebook": { group: "branding", type: "text", value: "" },

  // --- Appearance ---------------------------------------------------------
  "appearance.defaultTheme": { group: "appearance", type: "text", value: "aurora" },
  "appearance.defaultColorMode": { group: "appearance", type: "select", value: "dark", options: ["dark", "light", "system"] },
  "appearance.allowUserTheme": { group: "appearance", type: "boolean", value: true },
  // Whatever the operator wants beside the headline: a mascot, a product
  // shot, a photograph. Left empty the hero shows live order cards instead,
  // which needs no artwork and is true.
  "landing.heroImage": { group: "appearance", type: "image", value: "" },
  // Panels here quote a rate per thousand; buyers here think in dong per
  // follow. Which one leads is the operator's call.
  "landing.priceUnit": { group: "appearance", type: "select", value: "perUnit", options: ["perUnit", "per1000"] },
  // Panels in this market put the sign-in box on the home page, because most
  // visitors are returning customers. Off gives the plain pair of buttons.
  "landing.heroLogin": { group: "appearance", type: "boolean", value: true },
  "appearance.landingLayout": {
    group: "appearance",
    type: "select",
    value: "priceBoard",
    options: ["priceBoard", "orderFirst", "proof", "editorial", "catalogue"],
  },

  // --- Search -------------------------------------------------------------
  // Off while a panel is being set up: a half-built site is easier to keep
  // out of an index than to get back out of one.
  "seo.indexable": { group: "seo", type: "boolean", value: true },
  // IndexNow is an open protocol with no account and no quota — the key is
  // just a string this panel also serves at /<key>.txt, and that file is the
  // whole of the authentication. Bing, Yandex, Seznam and Naver share
  // submissions; Google does not take part.
  "seo.indexNowKey": { group: "seo", type: "text", value: "" },
  // Pasted from Search Console and Webmaster Tools when they ask for a meta
  // tag rather than a DNS record.
  "seo.googleVerification": { group: "seo", type: "text", value: "" },
  "seo.bingVerification": { group: "seo", type: "text", value: "" },

  // --- Rank tracking ------------------------------------------------------
  // Off until an operator has somewhere to read rankings from. Turning it on
  // is all that starting it takes: the scheduler already runs.
  "rank.enabled": { group: "seo", type: "boolean", value: false },
  "rank.source": { group: "seo", type: "select", value: "searchConsole", options: ["searchConsole", "serpApi"] },
  // Rankings barely move within a day and both sources cost something to ask
  // — money for one, quota for the other — so the default is daily.
  "rank.checkEveryHours": { group: "seo", type: "number", value: 24 },
  // Search Console. A service account rather than a personal login, so the
  // report does not stop the day whoever set it up leaves.
  //
  // The property as Search Console spells it, which is not the panel's own
  // address: a domain property is "sc-domain:example.com". Only this driver
  // uses it — a SERP vendor is matched against the real site.
  "rank.siteUrl": { group: "seo", type: "text", value: "" },
  "rank.serviceAccountJson": { group: "seo", type: "password", value: "" },

  // Any SERP vendor: the endpoint carries {query}, {country} and {key}, and
  // the two paths say where that vendor puts its results.
  "rank.serpUrl": { group: "seo", type: "text", value: "" },
  "rank.serpKey": { group: "seo", type: "password", value: "" },
  "rank.serpResultsPath": { group: "seo", type: "text", value: "organic_results" },
  "rank.serpLinkField": { group: "seo", type: "text", value: "link" },

  // Overridable so the whole thing can be pointed at a local stand-in and
  // proved to work without a paid key or a live Google property.
  "rank.apiBase": { group: "seo", type: "text", value: "" },
  "rank.tokenUrl": { group: "seo", type: "text", value: "" },

  // --- Localisation -------------------------------------------------------
  "locale.default": { group: "locale", type: "text", value: "vi" },
  "locale.allowUserLocale": { group: "locale", type: "boolean", value: true },
  "locale.timezone": { group: "locale", type: "text", value: "Asia/Ho_Chi_Minh" },
  "locale.allowUserTimezone": { group: "locale", type: "boolean", value: true },
  "currency.base": { group: "locale", type: "text", value: "VND" },
  "currency.autoUpdate": { group: "locale", type: "boolean", value: false },
  "currency.rateApiUrl": {
    group: "locale",
    type: "text",
    value: "https://open.er-api.com/v6/latest/{base}",
  },
  "currency.rateApiKey": { group: "locale", type: "password", value: "" },
  "currency.rateMargin": { group: "locale", type: "number", value: 0 },
  "currency.updateEveryHours": { group: "locale", type: "number", value: 12 },
  "currency.display": { group: "locale", type: "text", value: "VND" },
  "currency.allowUserCurrency": { group: "locale", type: "boolean", value: true },

  // --- Orders -------------------------------------------------------------
  "order.enabled": { group: "order", type: "boolean", value: true },
  "order.minCharge": { group: "order", type: "number", value: 0 },
  "order.duplicateWindowMinutes": { group: "order", type: "number", value: 0 },
  // How far back the provider health figures look. Short enough that a
  // supplier going bad shows up, long enough that a quiet week is not noise.
  "provider.healthWindowDays": { group: "order", type: "number", value: 30 },
  "order.maxPerMinute": { group: "order", type: "number", value: 0 },
  // On by default because that is what the panel has always done; turning it
  // off holds the queue for an operator to send by hand.
  "order.autoSendToProvider": { group: "order", type: "boolean", value: true },
  "order.refillWindowDays": { group: "order", type: "number", value: 30 },
  "order.allowCancelRequests": { group: "order", type: "boolean", value: true },
  "order.autoApproveRefill": { group: "order", type: "boolean", value: false },
  "order.autoApproveCancel": { group: "order", type: "boolean", value: false },
  "order.stuckAfterMinutes": { group: "order", type: "number", value: 0 },
  /// What the customer should know before spending, shown on every category's
  /// order page. One note per line, "Heading | what it means"; a line with no
  /// bar is a heading-less note. Blank hides the card entirely rather than
  /// leaving an empty box, because a panel with nothing to warn about should
  /// not look like one that forgot to fill this in.
  "order.notes": { group: "order", type: "textarea", value: "" },
  /// How far ahead an order may be scheduled. Zero hides the control entirely
  /// — an operator who does not want to hold paid orders should not have to
  /// explain to customers why theirs is not moving.
  "order.scheduleMaxDays": { group: "order", type: "number", value: 0 },

  // --- Abuse controls -----------------------------------------------------
  // Every one of these is off at zero, and every one ships at zero. A panel
  // whose customers are honest should never notice they exist, and holding a
  // real customer's order is worse than losing one order to a fraudster.
  //
  // The same link ordered from several accounts is the cheapest way around a
  // per-account limit. Legitimate too — an agency running one client's page
  // from several logins — which is why it holds rather than refuses.
  "guard.sharedLinkAccounts": { group: "order", type: "number", value: 0 },
  "guard.sharedLinkHours": { group: "order", type: "number", value: 24 },
  // A brand new account that has never paid in, spending big, is the shape of
  // a stolen card being emptied before the chargeback lands.
  "guard.minAccountAgeMinutes": { group: "order", type: "number", value: 0 },
  "guard.newAccountMaxCharge": { group: "order", type: "number", value: 0 },

  // --- Scheduler ----------------------------------------------------------
  // How long the panel waits before saying the scheduler has stopped. Zero
  // switches the warning off for a deployment that runs the cycle by hand.
  // Fifteen minutes is a few missed five-minute ticks, not one.
  "sync.staleAfterMinutes": { group: "order", type: "number", value: 15 },

  // --- Wallet -------------------------------------------------------------
  "wallet.minDeposit": { group: "wallet", type: "number", value: 20000 },
  "wallet.maxDeposit": { group: "wallet", type: "number", value: 500000000 },
  "wallet.autoApprove": { group: "wallet", type: "boolean", value: true },
  "wallet.quickAmounts": {
    group: "wallet",
    type: "json",
    value: {
      VND: [50000, 100000, 200000, 500000, 1000000],
      USD: [5, 10, 25, 50, 100],
      EUR: [5, 10, 25, 50, 100],
      TRY: [100, 250, 500, 1000],
      INR: [500, 1000, 2500, 5000],
    } as Record<string, number[]>,
  },

  // --- Affiliate ----------------------------------------------------------
  "affiliate.enabled": { group: "affiliate", type: "boolean", value: true },
  "affiliate.commissionPercent": { group: "affiliate", type: "number", value: 5 },
  "affiliate.minWithdraw": { group: "affiliate", type: "number", value: 50000 },

  // --- Registration -------------------------------------------------------
  "auth.registrationOpen": { group: "auth", type: "boolean", value: true },
  "auth.requireEmailVerification": { group: "auth", type: "boolean", value: false },
  "auth.requireAdminTwoFactor": { group: "auth", type: "boolean", value: false },
  "auth.signupBonus": { group: "auth", type: "number", value: 0 },
  "auth.captchaProvider": {
    group: "auth",
    type: "select",
    value: "off",
    options: ["off", "turnstile", "hcaptcha", "recaptcha"],
  },
  "auth.captchaSiteKey": { group: "auth", type: "text", value: "" },
  "auth.captchaSecret": { group: "auth", type: "password", value: "" },
  "auth.captchaOnLogin": { group: "auth", type: "boolean", value: true },
  "auth.captchaOnRegister": { group: "auth", type: "boolean", value: true },
  "auth.termsRequired": { group: "auth", type: "boolean", value: true },

  // --- API ----------------------------------------------------------------
  "api.enabled": { group: "api", type: "boolean", value: true },
  "api.rateLimitPerMinute": { group: "api", type: "number", value: 120 },
  // Callbacks cost nothing until a reseller sets a URL, so they are on.
  "api.callbacksEnabled": { group: "api", type: "boolean", value: true },
  "api.callbackAttempts": { group: "api", type: "number", value: 6 },
  // A callback URL is typed by a customer and dialled by this server, so
  // refusing private addresses is the difference between a webhook and a
  // way to probe the panel's own network. Off only for a panel that really
  // does need to call something on its own side.
  "api.callbackBlockPrivate": { group: "api", type: "boolean", value: true },

  // --- Email --------------------------------------------------------------
  "mail.enabled": { group: "mail", type: "boolean", value: false },
  "mail.host": { group: "mail", type: "text", value: "" },
  "mail.port": { group: "mail", type: "number", value: 587 },
  "mail.secure": { group: "mail", type: "boolean", value: false },
  "mail.user": { group: "mail", type: "text", value: "" },
  "mail.password": { group: "mail", type: "password", value: "" },
  "mail.fromName": { group: "mail", type: "text", value: "" },
  "mail.fromAddress": { group: "mail", type: "text", value: "" },
  "mail.resetWindowMinutes": { group: "mail", type: "number", value: 60 },
  // Which notifications are also worth an email. Off by default: a panel that
  // has just configured SMTP should not start mailing its whole customer base
  // because someone flipped one switch.
  "mail.onOrder": { group: "mail", type: "boolean", value: false },
  "mail.onWallet": { group: "mail", type: "boolean", value: false },
  "mail.onSupport": { group: "mail", type: "boolean", value: false },
  "mail.onAdmin": { group: "mail", type: "boolean", value: false },

  // --- Support ------------------------------------------------------------
  "support.enabled": { group: "support", type: "boolean", value: true },
  "support.maxOpenTickets": { group: "support", type: "number", value: 5 },
  "support.categories": {
    group: "support",
    type: "list",
    value: ["general", "payment", "order", "api", "other"],
  },

  // --- Child panels -------------------------------------------------------
  "panel.childrenEnabled": { group: "panel", type: "boolean", value: false },
  "panel.maxDepth": { group: "panel", type: "number", value: 3 },
  "panel.maxChildren": { group: "panel", type: "number", value: 0 },
  "panel.rentPrice": { group: "panel", type: "number", value: 0 },
  "panel.rentPeriodDays": { group: "panel", type: "number", value: 30 },
  "panel.graceDays": { group: "panel", type: "number", value: 3 },
  "panel.cloudflareToken": { group: "panel", type: "password", value: "" },
  "panel.cloudflareZoneId": { group: "panel", type: "text", value: "" },
  // Needed only to take on a reseller's own domain: adding a zone is an
  // account-level call, where pointing a subdomain is a zone-level one.
  "panel.cloudflareAccountId": { group: "panel", type: "text", value: "" },
  // Whether customers may ask for a panel themselves. Off until the operator
  // decides to sell them, because the form is on every customer's dashboard.
  "panel.selfServeEnabled": { group: "panel", type: "boolean", value: false },

  // --- Maintenance --------------------------------------------------------
  "maintenance.enabled": { group: "maintenance", type: "boolean", value: false },
  "maintenance.message": {
    group: "maintenance",
    type: "textarea",
    value: "We are performing scheduled maintenance. Please come back shortly.",
  },
} as const;

export type SettingKey = keyof typeof settingDefinitions;
type SettingValue<K extends SettingKey> = (typeof settingDefinitions)[K]["value"];

/**
 * Read once per request, per panel.
 *
 * This used to be a module-level Map with a five-second TTL, cleared by
 * `invalidateSettings` after every write. It did not work: in Next the server
 * action and the render that follows it do not always share a module
 * instance, so the clear landed on one copy of the Map while the page read
 * the other. Every setting an operator changed took up to five seconds to
 * appear, and the panel spent that time telling them their change had saved.
 *
 * React's `cache` is per request instead of per process. It still collapses
 * the several reads a single page makes into one query, and a write is
 * visible on the very next request because there is no copy left to be stale.
 * The same pattern the panel already uses for resolving the panel itself.
 */
const load = cache(async (panelId: string): Promise<Map<string, unknown>> => {
  void panelId; // The key: one entry per panel, never shared between them.
  const rows = await db.setting.findMany();
  const map = new Map<string, unknown>();
  for (const row of rows) {
    try {
      map.set(row.key, JSON.parse(row.value));
    } catch {
      // A value written before it had a JSON shape is still a value.
      map.set(row.key, row.value);
    }
  }
  return map;
});

/** Every read goes through the panel in context, so nothing crosses panels. */
async function settingsMap(): Promise<Map<string, unknown>> {
  return load(await currentPanelId());
}

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const map = await settingsMap();
  if (map.has(key)) return map.get(key) as SettingValue<K>;
  return settingDefinitions[key].value as SettingValue<K>;
}

export async function getSettings(): Promise<Record<SettingKey, unknown>> {
  const map = await settingsMap();
  const out = {} as Record<string, unknown>;
  for (const [key, def] of Object.entries(settingDefinitions)) {
    out[key] = map.has(key) ? map.get(key) : def.value;
  }
  return out as Record<SettingKey, unknown>;
}

export async function setSetting(key: string, value: unknown) {
  const group = (settingDefinitions as Record<string, { group: string }>)[key]?.group ?? "general";
  const panelId = await currentPanelId();
  await db.setting.upsert({
    where: { panelId_key: { panelId, key } },
    create: { key, value: JSON.stringify(value), group },
    update: { value: JSON.stringify(value), group },
  });
}

export async function setSettings(entries: Record<string, unknown>) {
  for (const [key, value] of Object.entries(entries)) await setSetting(key, value);
}
