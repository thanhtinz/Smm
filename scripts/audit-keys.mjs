/**
 * Every translation key the source names must exist in the bundled dictionary.
 *
 * t() returns the key when it misses — it does not throw and does not log, it
 * renders the raw key on the customer's screen. That has shipped twice in this
 * project ("dash.balance", "order.selectPlatform"), both times caught only by
 * looking at a screenshot. This makes it a check instead.
 *
 *   npm run keys:check
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const { en, vi } = await import("../src/lib/dictionaries.ts");
const { ORDER_STATUSES } = await import("../src/lib/orders.ts");
const { CRON_JOBS } = await import("../src/lib/cron-jobs.ts");

/**
 * Keys that are English on purpose. They are written into the database —
 * an order's hold reason, read later by whoever opens that order — and a
 * stored string outlives the language of whoever triggered it. See lib/fault.
 */
const ENGLISH_ON_PURPOSE = [/^hold\./];

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(ts|tsx)$/.test(path) && !path.endsWith("dictionaries.ts")) files.push(path);
  }
})("src");

const sources = files.map((file) => [file, readFileSync(file, "utf8")]);

// Only what is actually handed to a translator. A dotted string on its own
// proves nothing: setting names ("order.allowCancelRequests"), log actions and
// CSS are all dotted too, and treating those as keys buries the real misses
// under two hundred false ones.
//
// Keys built from a list — `status.${s}`, `cron.job.${k}` — are recorded as a
// prefix instead, because the halves only meet at runtime.
const TRANSLATED = [
  /\bt\(\s*["'`]([\w.]+)["'`]/g,
  // Refusals name their key and leave the wording to the caller (lib/fault).
  /\benglishMessage\(\s*["'`]([\w.]+)["'`]/g,
  // A Fault names its key and lets the caller word it — but only ever an
  // "err." or a "hold." one. Every other `key:` in this codebase is an object
  // identifier ("momo", "dispatch"), and matching those buried the real
  // misses under fifty invented ones.
  /\bkey:\s*["'`]((?:err|hold)\.[\w.]+)["'`]/g,
];

const named = new Map();
const prefixes = new Set();
for (const [file, text] of sources) {
  for (const pattern of TRANSLATED) {
    for (const m of text.matchAll(pattern)) if (!named.has(m[1])) named.set(m[1], file);
  }
  for (const m of text.matchAll(/["'`]([a-z][\w.]*)\.\$\{/gi)) prefixes.add(`${m[1]}.`);
}

const missing = [];
for (const [key, file] of named) {
  if (!(key in en)) missing.push([key, file]);
}

// For "is anything still reaching this key", a plain mention is enough — the
// point of that list is to spot wording nobody can see, not to be strict.
const mentioned = new Set();
for (const [, text] of sources) {
  for (const m of text.matchAll(/["'`]([a-z][\w]*(?:\.[\w]+)+)["'`]/gi)) mentioned.add(m[1]);
}

const untranslated = Object.keys(en).filter(
  (k) => !(k in vi) && !ENGLISH_ON_PURPOSE.some((rule) => rule.test(k)),
);

const unreferenced = Object.keys(en).filter(
  (k) => !mentioned.has(k) && ![...prefixes].some((p) => k.startsWith(p)),
);

/**
 * Keys nothing spells out.
 *
 * `t(`status.${s}`)` is invisible to any amount of reading the call site: the
 * halves meet at runtime, and the list they come from lives in another file.
 * These are the lists, so a status or a cron job added without its wording is
 * caught here rather than by a customer seeing "status.refunded".
 */
const built = [
  ...ORDER_STATUSES.map((s) => [`status.${s}`, "order status"]),
  ...CRON_JOBS.flatMap((j) => [
    [`cron.job.${j.key}`, "cron job"],
    [`cron.jobHint.${j.key}`, "cron job"],
  ]),
  ...["pending", "approved", "rejected", "completed"].map((s) => [`request.status.${s}`, "request state"]),
  ...["low", "normal", "high", "urgent"].map((p) => [`support.priority.${p}`, "ticket priority"]),
  // requestKey() spells these from a type and a decision.
  ...["refill", "cancel"].flatMap((type) =>
    ["Approved", "Rejected", "Completed"].map((d) => [`notify.request.${type}${d}.title`, "request outcome"]),
  ),
];
for (const [key, why] of built) if (!(key in en)) missing.push([key, `built at runtime — ${why}`]);

for (const [key, file] of missing) console.log(`MISSING   ${key}   ${file}`);
for (const key of untranslated) console.log(`NO VI     ${key}`);

console.log(`\n${Object.keys(en).length} keys. ${missing.length} missing, ${untranslated.length} untranslated, ${unreferenced.length} unreferenced.`);
if (unreferenced.length) {
  // Not a failure: a key can be reached from a future page, and deleting one
  // that is still in a panel's Translation table changes nothing anyway.
  console.log(`unreferenced (not a failure): ${unreferenced.join(", ")}`);
}

process.exit(missing.length + untranslated.length === 0 ? 0 : 1);
