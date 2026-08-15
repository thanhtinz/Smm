import { getSettings } from "@/lib/settings";

/**
 * Where a ranking comes from.
 *
 * Two sources, because they answer different questions and an operator will
 * have access to one or the other rather than both:
 *
 *  - Search Console is Google telling you about your own site. Free, exact,
 *    and limited to phrases you already appear for — it cannot tell you that
 *    you are nowhere, only that you are somewhere.
 *  - A SERP API is a paid service that runs the search and reads the page.
 *    It sees phrases you do not rank for at all, which is most of them.
 *
 * There is deliberately no third driver that fetches google.com directly.
 * That is against Google's terms, it is blocked within a few requests, and a
 * panel whose SEO tool gets its server's address flagged has traded a report
 * for its own visibility.
 */

export type Ranking = {
  phrase: string;
  /** 0 when the phrase was searched and this site was not found. */
  position: number;
  url: string;
};

export type RankResult = { ok: true; rankings: Ranking[] } | { ok: false; error: string };

export type RankQuery = { phrase: string; country: string };

export type RankDriver = {
  kind: string;
  /** Setting keys this driver needs filled in before it can run. */
  requires: string[];
  /**
   * One call for the whole batch where the source allows it, so a hundred
   * phrases do not cost a hundred requests — Search Console returns every
   * query at once, a SERP API charges per search and cannot.
   */
  fetch(config: Record<string, string>, queries: RankQuery[], site: string): Promise<RankResult>;
};

const TIMEOUT_MS = 20_000;

async function getJson(url: string, init: RequestInit = {}): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, error: `Not JSON (HTTP ${res.status})` };
    }
    if (!res.ok) {
      const message = (data as { error?: { message?: string } | string })?.error;
      return {
        ok: false,
        error: typeof message === "string" ? message : (message?.message ?? `HTTP ${res.status}`),
      };
    }
    return { ok: true, data };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return { ok: false, error: "Timed out" };
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Google Search Console.
 *
 * Authenticated with a service account, not a user OAuth flow: the panel runs
 * this unattended from cron, and a refresh token tied to one person's Google
 * account stops working the day they leave. The operator creates the service
 * account, downloads its JSON, and adds its email as a user on the property —
 * three steps they do once, all of them outside this panel.
 *
 * The API reports average position over a date range rather than a position
 * right now, and it lags about three days. Both are properties of the data,
 * not of this code, and the admin screen says so rather than pretending the
 * number is live.
 */
const searchConsole: RankDriver = {
  kind: "searchConsole",
  requires: ["rank.serviceAccountJson", "rank.siteUrl"],

  async fetch(config, queries, site) {
    const token = await serviceAccountToken(config["rank.serviceAccountJson"], config["rank.tokenUrl"]);
    if (!token.ok) return token;

    const property = config["rank.siteUrl"] || site;
    // Search Console has no data for the last couple of days, so a window
    // ending today would report a phrase as missing when it is merely recent.
    const end = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
    const start = new Date(Date.now() - 31 * 864e5).toISOString().slice(0, 10);

    const base = config["rank.apiBase"] || "https://searchconsole.googleapis.com";
    const result = await getJson(`${base}/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: start,
        endDate: end,
        dimensions: ["query", "page"],
        rowLimit: 5000,
      }),
    });
    if (!result.ok) return result;

    const rows = (result.data as { rows?: { keys?: string[]; position?: number }[] }).rows ?? [];
    // Keyed by phrase so the lookup below is not quadratic over 5000 rows.
    const best = new Map<string, { position: number; url: string }>();
    for (const row of rows) {
      const phrase = (row.keys?.[0] ?? "").toLowerCase();
      const position = Math.round(row.position ?? 0);
      if (!phrase || position <= 0) continue;
      const current = best.get(phrase);
      if (!current || position < current.position) best.set(phrase, { position, url: row.keys?.[1] ?? "" });
    }

    return {
      ok: true,
      rankings: queries.map((q) => {
        const hit = best.get(q.phrase.toLowerCase());
        return { phrase: q.phrase, position: hit?.position ?? 0, url: hit?.url ?? "" };
      }),
    };
  },
};

/**
 * A paid SERP API, whichever one the operator bought.
 *
 * Not hard-coded to a vendor: they all take a query and a key and return a
 * list of results, and the differences are the parameter names and where the
 * list sits in the JSON. Those are three settings — the endpoint with
 * placeholders, the path to the results array, and the field holding each
 * result's link — so an operator can point this at the service they already
 * pay for instead of the one that happened to be implemented.
 */
const serpApi: RankDriver = {
  kind: "serpApi",
  requires: ["rank.serpUrl", "rank.serpKey"],

  async fetch(config, queries, site) {
    const template = config["rank.serpUrl"];
    const resultsPath = config["rank.serpResultsPath"] || "organic_results";
    const linkField = config["rank.serpLinkField"] || "link";
    // The panel's own address, not `rank.siteUrl`: that setting holds the
    // property as Search Console spells it, which for a domain property is
    // "sc-domain:example.com" and is not a URL at all. What appears in a
    // search result is the site itself.
    const host = hostOf(site);
    if (!host) return { ok: false, error: "The panel has no address to look for" };

    const rankings: Ranking[] = [];
    for (const q of queries) {
      const url = template
        .replaceAll("{query}", encodeURIComponent(q.phrase))
        .replaceAll("{country}", encodeURIComponent(q.country))
        .replaceAll("{key}", encodeURIComponent(config["rank.serpKey"] ?? ""));

      const result = await getJson(url);
      // One phrase failing is not the batch failing: a SERP API rate-limits
      // per search, and losing ninety-nine readings to the hundredth would
      // make the whole report useless on a busy day.
      if (!result.ok) {
        rankings.push({ phrase: q.phrase, position: 0, url: `` });
        continue;
      }

      const list = readPath(result.data, resultsPath);
      let position = 0;
      let found = "";
      if (Array.isArray(list)) {
        for (const [index, item] of list.entries()) {
          const link = String((item as Record<string, unknown>)?.[linkField] ?? "");
          if (hostOf(link) === host) {
            // The array's own order is the ranking. A `position` field, where
            // the vendor sends one, is trusted over the index because some
            // exclude ads from the list but not from the count.
            const stated = Number((item as Record<string, unknown>)?.position);
            position = Number.isInteger(stated) && stated > 0 ? stated : index + 1;
            found = link;
            break;
          }
        }
      }
      rankings.push({ phrase: q.phrase, position, url: found });
    }

    return { ok: true, rankings };
  },
};

/** Dotted path into a JSON body, for vendors that nest their results. */
function readPath(data: unknown, path: string): unknown {
  let current = data;
  for (const part of path.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * A service account's JSON, exchanged for an access token.
 *
 * Written out rather than pulled from googleapis: that package is tens of
 * megabytes for what is one signed JWT and one POST, and this panel already
 * has to be careful about what it ships.
 */
async function serviceAccountToken(
  raw: string,
  tokenUrl?: string,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  let key: { client_email?: string; private_key?: string; token_uri?: string };
  try {
    key = JSON.parse(raw);
  } catch {
    return { ok: false, error: "The service account JSON could not be read" };
  }
  if (!key.client_email || !key.private_key) {
    return { ok: false, error: "The service account JSON has no client_email or private_key" };
  }

  const { createSign } = await import("node:crypto");
  const now = Math.floor(Date.now() / 1000);
  const endpoint = tokenUrl || key.token_uri || "https://oauth2.googleapis.com/token";

  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const claim = b64({
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: endpoint,
    exp: now + 3600,
    iat: now,
  });
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${claim}`;

  let signature: string;
  try {
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    signature = signer.sign(key.private_key.replace(/\\n/g, "\n"), "base64url");
  } catch {
    return { ok: false, error: "The private key in that JSON could not sign" };
  }

  const result = await getJson(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!result.ok) return result;

  const token = (result.data as { access_token?: string }).access_token;
  return token ? { ok: true, token } : { ok: false, error: "No access token came back" };
}

export const RANK_DRIVERS: RankDriver[] = [searchConsole, serpApi];

export function rankDriver(kind: string): RankDriver | undefined {
  return RANK_DRIVERS.find((d) => d.kind === kind);
}

/**
 * The chosen driver and its settings, or why it cannot run.
 *
 * The missing-fields check is here rather than in each driver so the admin
 * screen can say "you have not filled in the site address" instead of the
 * driver failing at the source and reporting whatever that source says about
 * an empty parameter.
 */
export async function activeRankSource(): Promise<
  { ok: true; driver: RankDriver; config: Record<string, string> } | { ok: false; reason: string }
> {
  const settings = await getSettings();
  if (!settings["rank.enabled"]) return { ok: false, reason: "off" };

  const driver = rankDriver(String(settings["rank.source"] ?? ""));
  if (!driver) return { ok: false, reason: "noSource" };

  const config: Record<string, string> = {};
  for (const [key, value] of Object.entries(settings)) {
    if (key.startsWith("rank.")) config[key] = String(value ?? "");
  }

  const missing = driver.requires.filter((key) => !config[key]?.trim());
  if (missing.length) return { ok: false, reason: `missing:${missing.join(",")}` };

  return { ok: true, driver, config };
}
