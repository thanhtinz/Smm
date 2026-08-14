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
  const tag = locale === "vi" ? "vi-VN" : locale;
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
    const parts = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : locale, {
      timeZone: name,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const offset = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    return offset ? `${name.replace(/_/g, " ")} · ${offset}` : name.replace(/_/g, " ");
  } catch {
    return name;
  }
}
