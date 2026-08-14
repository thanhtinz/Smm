/**
 * Notifications, in the reader's language.
 *
 * A notification is written by a webhook, a cron pass or an admin action —
 * none of which know who will read it, and a panel serves several languages at
 * once. So the sentence is not written at all: the event and its values are
 * stored, and the words are chosen when someone opens the bell.
 *
 * The English rendering is still written to `title`/`body`. It is not what the
 * UI shows; it is what an operator reads straight out of the database, and
 * what rows created before this existed still fall back to.
 */

import { en } from "./dictionaries";
import type { Translator } from "./i18n";

export type NotifyParams = Record<string, string | number | Alert[]>;

/** One line inside a provider sync report, kept as data for the same reason. */
export type Alert = { key: string; [param: string]: string | number };

export type NotifyInput = {
  userId: string;
  /** An event name; `notify.<key>.title` and `.body` are its two strings. */
  key: string;
  params?: NotifyParams;
  level?: "info" | "success" | "warning" | "danger";
  href?: string;
};

/**
 * A string in English, whatever the reader's language.
 *
 * Two callers want this. The stored notification fallback below, and the API,
 * whose messages are read by a reseller's client code rather than by a person
 * — translating those would break every integration.
 */
export function englishMessage(key: string, vars?: Record<string, string | number>): string {
  return english(key, (vars ?? {}) as NotifyParams);
}

/** English, for the stored fallback. */
function english(key: string, params: NotifyParams): string {
  const dict = en as unknown as Record<string, string>;
  let out = dict[key] ?? "";
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) continue;
    out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}

/**
 * The row to write. Returned rather than written so the many callers inside a
 * `db.$transaction` can hand it to their own client.
 */
export function notification(input: NotifyInput) {
  const params = input.params ?? {};
  return {
    userId: input.userId,
    key: input.key,
    params: JSON.stringify(params),
    title: english(`notify.${input.key}.title`, params),
    body: renderBody(input.key, params, (k, v) => english(k, (v ?? {}) as NotifyParams)),
    level: input.level ?? "info",
    href: input.href ?? "",
  };
}

/**
 * Refill and cancel decisions share one shape but not one sentence: English
 * says "Refill request approved" and "Cancellation approved", and Vietnamese
 * rewords both. So the pair becomes one key rather than two words joined.
 */
export function requestKey(type: string, decision: string): string {
  const kind = type === "refill" ? "refill" : "cancel";
  const outcome = decision === "rejected" ? "Rejected" : decision === "completed" ? "Completed" : "Approved";
  return `request.${kind}${outcome}`;
}

/** The same row for a list of recipients — every admin on the panel, usually. */
export function notifications(userIds: string[], input: Omit<NotifyInput, "userId">) {
  return userIds.map((userId) => notification({ ...input, userId }));
}

type Render = (key: string, vars?: Record<string, string | number>) => string;

function renderBody(key: string, params: NotifyParams, t: Render): string {
  // A note is written by a person, for this one reader. Translating it would
  // be putting words in their mouth, so it replaces the body as typed.
  if (typeof params.note === "string" && params.note) return params.note;

  // A report is a list of findings, each its own sentence with its own values.
  const alerts = params.alerts;
  if (Array.isArray(alerts)) {
    return alerts.map((a) => t(`notify.alert.${a.key}`, a as Record<string, string | number>)).join("\n");
  }

  return t(`notify.${key}.body`, params as Record<string, string | number>);
}

/**
 * The two strings a reader sees. Rows written before keys existed have no
 * key, and keep the English they were written with.
 */
export function renderNotification(
  row: { key: string; params: string; title: string; body: string },
  t: Translator,
): { title: string; body: string } {
  if (!row.key) return { title: row.title, body: row.body };

  let params: NotifyParams = {};
  try {
    params = JSON.parse(row.params) as NotifyParams;
  } catch {
    // A row we cannot parse is still a row worth showing.
    return { title: row.title, body: row.body };
  }

  return {
    title: t(`notify.${row.key}.title`, params as Record<string, string | number>),
    body: renderBody(row.key, params, t),
  };
}
