/**
 * Dates, in the reader's timezone.
 *
 * Every page used to build its own Intl formatter with no timeZone, which
 * meant every timestamp was rendered wherever the server happens to run —
 * UTC in production. A customer in Vietnam saw their 9pm order stamped 2pm.
 *
 * One place to build them, so the next page cannot quietly go back to the
 * server's clock, and so a panel-wide change is a change in one file.
 */

import { localeTag } from "./numbers";

export type DateFormats = {
  /** 13 thg 8, 2026 — a day, where the hour would be noise. */
  day: (value: Date) => string;
  /** 21:58 13-08 — the compact stamp the admin tables use. */
  stamp: (value: Date) => string;
  /** 13 thg 8, 2026 lúc 21:58 — a moment, spelled out. */
  full: (value: Date) => string;
  /** 21:58:07 13-08 — to the second, for the activity log. */
  precise: (value: Date) => string;
};

export function dateFormats(locale: string, timeZone: string): DateFormats {
  // Intl wants a BCP 47 tag; the panel stores bare language codes.
  const tag = localeTag(locale);
  const make = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(tag, { ...options, timeZone });

  const day = make({ dateStyle: "medium" });
  const stamp = make({ day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const full = make({ dateStyle: "medium", timeStyle: "short" });
  const precise = make({ day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return {
    day: (value) => day.format(value),
    stamp: (value) => stamp.format(value),
    full: (value) => full.format(value),
    precise: (value) => precise.format(value),
  };
}

/**
 * A span of seconds in the reader's words: "2h 15m", "8 phút".
 *
 * Rounded to two units, because a delivery time is read to decide whether a
 * supplier is slow, not to settle a stopwatch.
 */
export function formatDuration(seconds: number | null, t: (key: string, vars?: Record<string, string | number>) => string): string {
  if (seconds === null) return "—";
  if (seconds < 60) return t("time.seconds", { n: seconds });

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("time.minutes", { n: minutes });

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 24) {
    return restMinutes ? t("time.hoursMinutes", { h: hours, m: restMinutes }) : t("time.hours", { n: hours });
  }

  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? t("time.daysHours", { d: days, h: restHours }) : t("time.days", { n: days });
}

/**
 * The zones offered in the account page.
 *
 * A short list rather than every name Intl knows: a picker with 400 entries
 * is worse than one with the twenty a panel's customers actually live in,
 * and any other name can still be set as the panel default in the admin.
 */
export const TIMEZONES = [
  "Asia/Ho_Chi_Minh",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Singapore",
  "Asia/Manila",
  "Asia/Kuala_Lumpur",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Seoul",
  "Asia/Tokyo",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Karachi",
  "Asia/Dubai",
  "Asia/Istanbul",
  "Europe/Moscow",
  "Europe/Berlin",
  "Europe/London",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Australia/Sydney",
  "UTC",
] as const;

/** `Asia/Ho_Chi_Minh · GMT+7`, so a reader can pick without knowing the name. */
export function describeZone(name: string, locale: string): string {
  try {
    const parts = new Intl.DateTimeFormat(localeTag(locale), {
      timeZone: name,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const offset = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    return offset ? `${name.replace(/_/g, " ")} · ${offset}` : name.replace(/_/g, " ");
  } catch {
    return name;
  }
}

/**
 * The calendar day an instant falls on in a named zone, as "2026-08-20".
 *
 * The counterpart to parseLocalTime, and it exists so a date can survive a
 * round trip. `toISOString().slice(0, 10)` reads the day in UTC, which is a
 * different day from the reader's for part of every day: an end date entered
 * as the 20th on a server running east of UTC came back as the 19th, and came
 * back a day earlier again on each reorder.
 */
export function formatLocalDay(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const at = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${at("year")}-${at("month")}-${at("day")}`;
}

/**
 * "2026-08-20T14:30" in a named zone, as the instant it names.
 *
 * A `datetime-local` field sends a wall clock with no zone attached, and the
 * only sensible reading of it is the reader's own. Doing that without a
 * library takes two passes: build the instant as if the text were UTC, ask
 * what that instant looks like in the target zone, and shift by the gap. Once
 * is not enough at a daylight-saving boundary, where the gap itself moves.
 *
 * Returns null on anything that is not a well-formed local time, so a hand
 * edited field cannot land a nonsense date in the database.
 */
export function parseLocalTime(value: string, timeZone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const [, y, mo, d, h, mi] = match.map(Number) as unknown as number[];
  // Date.UTC rolls over rather than refusing: month 13 becomes next January
  // and hour 99 becomes four days later, so "2026-13-40T99:99" would quietly
  // become a real instant nobody typed. The ranges are checked first.
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;

  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  if (!Number.isFinite(asUtc)) return null;
  // And the day has to exist in that month: 31 February passes the ranges.
  const rolled = new Date(asUtc);
  if (rolled.getUTCMonth() !== mo - 1 || rolled.getUTCDate() !== d) return null;

  const offsetAt = (instant: number) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(instant));
    const at = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    // 24 is how this formatter spells midnight.
    const hour = at("hour") % 24;
    return Date.UTC(at("year"), at("month") - 1, at("day"), hour, at("minute"), at("second")) - instant;
  };

  let instant: number;
  try {
    instant = asUtc - offsetAt(asUtc);
    instant = asUtc - offsetAt(instant);
  } catch {
    // An unknown zone name.
    return null;
  }

  const out = new Date(instant);
  return Number.isNaN(out.getTime()) ? null : out;
}
