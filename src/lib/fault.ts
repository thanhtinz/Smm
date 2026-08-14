/**
 * A refusal, before it has been put into words.
 *
 * Some refusals are read by more than one audience. The order guard answers a
 * customer on the web and a reseller's client over API v2 in the same breath;
 * a refill decision is shown to an admin, written into the request's note and
 * copied into the activity log. Those want different languages — the reader's,
 * fixed English, fixed English — so the function that refuses says what was
 * wrong and leaves the wording to whoever is doing the telling.
 */

import { en } from "./dictionaries";

export type Fault = { key: string; vars?: Record<string, string | number> };

/**
 * English, whatever the reader's language: for the API, whose messages are
 * part of a contract with client code, and for anything stored or logged,
 * which outlives whoever happened to trigger it.
 */
export function englishMessage(key: string, vars?: Record<string, string | number>): string {
  const dict = en as unknown as Record<string, string>;
  let out = dict[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}
