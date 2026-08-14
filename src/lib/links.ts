/**
 * What a link has to look like before an order is worth placing.
 *
 * Until now the only question asked was "is this a URL?", so a customer could
 * paste their profile into a likes-on-a-post service. The panel took the
 * money, the provider refused it an hour later, and the panel refunded — a
 * round trip that cost everyone time to learn something knowable at the form.
 *
 * The rules are the platform's, and they are edited in admin: an operator who
 * sells on a platform this panel has never heard of writes its shape once and
 * every service under it is checked.
 */

import type { Fault } from "./fault";

export type LinkRules = {
  hosts: string;
  postPattern: string;
  profilePattern: string;
  postExample: string;
  profileExample: string;
};

/**
 * The columns to pull when a query needs the rules. Kept here so a caller
 * cannot select four of the five and silently lose a check.
 */
export const LINK_RULES = {
  hosts: true,
  postPattern: true,
  profilePattern: true,
  postExample: true,
  profileExample: true,
} as const;

/** A platform that has told us nothing: every check below then passes. */
export const NO_RULES: LinkRules = {
  hosts: "",
  postPattern: "",
  profilePattern: "",
  postExample: "",
  profileExample: "",
};

/** Where an order is aimed: one post, or the account itself. */
export const LINK_TARGETS = ["post", "profile"] as const;
export type LinkTarget = (typeof LINK_TARGETS)[number];

/**
 * A link is long enough to be worth a bound before a hand-written regular
 * expression is run over it. The patterns come from an operator, not from
 * here, and a pathological one on a long string is a hung request.
 */
const MAX_LINK = 400;

export function parseHosts(hosts: string): string[] {
  return hosts
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/^www\./, ""))
    .filter(Boolean);
}

/** Compiles, or null — an operator's typo must not take the order form down. */
export function compilePattern(pattern: string): RegExp | null {
  if (!pattern.trim()) return null;
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

export function isValidPattern(pattern: string): boolean {
  return !pattern.trim() || compilePattern(pattern) !== null;
}

/**
 * The fault, or null when the link is fine. Every check is skipped when the
 * platform has not been given that rule, so a half-configured platform is
 * no stricter than the panel was before.
 */
export function checkLink(link: string, target: string, rules: LinkRules | null): Fault | null {
  rules ??= NO_RULES;
  const trimmed = link.trim();
  if (!trimmed || trimmed.length > MAX_LINK) return { key: "err.linkInvalid" };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { key: "err.linkInvalid" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { key: "err.linkInvalid" };

  const hosts = parseHosts(rules.hosts);
  if (hosts.length) {
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    // A subdomain counts: m.facebook.com is still Facebook.
    if (!hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
      return { key: "err.linkHost", vars: { hosts: hosts.join(", ") } };
    }
  }

  const wanted = target === "profile" ? "profile" : "post";
  const pattern = compilePattern(wanted === "profile" ? rules.profilePattern : rules.postPattern);
  if (!pattern) return null;

  const path = url.pathname + url.search;
  if (pattern.test(path)) return null;

  // Naming the other kind is the useful part: it is nearly always what was
  // pasted, and it tells the customer what to fix rather than that they erred.
  const other = compilePattern(wanted === "profile" ? rules.postPattern : rules.profilePattern);
  const example = wanted === "profile" ? rules.profileExample : rules.postExample;
  if (other?.test(path)) {
    return {
      key: wanted === "profile" ? "err.linkWantsProfile" : "err.linkWantsPost",
      vars: { example },
    };
  }
  return { key: example ? "err.linkShape" : "err.linkInvalid", vars: { example } };
}

/**
 * The @name inside a profile link, for a service that asks for one. A
 * customer given a username box will paste a link into it about as often as
 * the reverse, so both are accepted and one is stored.
 */
export function extractUsername(input: string): string {
  const trimmed = input.trim().replace(/^@/, "");
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const first = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return first.replace(/^@/, "") || trimmed;
  } catch {
    return trimmed;
  }
}

/**
 * The link as it will be stored and sent upstream: no tracking parameters, no
 * trailing slash. Two orders for the same post should look like the same
 * order, which is also what makes the duplicate guard work.
 */
export function normaliseLink(link: string): string {
  try {
    const url = new URL(link.trim());
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|igshid|si$|_r$|_t$|is_from|sender_device|mibextid|refsrc|source$)/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    url.hash = "";
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) url.pathname = url.pathname.slice(0, -1);
    return url.toString();
  } catch {
    return link.trim();
  }
}
