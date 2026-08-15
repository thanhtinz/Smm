/**
 * Plain numbers, in the reader's locale.
 *
 * Money already went through `displayMoney`, which knows the locale; the
 * counts beside it did not. `toLocaleString()` with no argument uses whatever
 * locale the process defaults to — the server's in a server component, the
 * browser's in a client one — so a Vietnamese panel printed the quantity as
 * "5,000" next to a price of "5.000 ₫", and the same page read differently
 * depending on where it was rendered.
 *
 * An eslint rule bans the bare call, so this cannot creep back in one row of
 * one table at a time.
 */

/** Intl wants a BCP 47 tag; the panel stores bare language codes. */
export function localeTag(locale: string): string {
  return locale === "vi" ? "vi-VN" : locale;
}

/** A count, grouped the way the reader groups digits. */
export function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(localeTag(locale)).format(value);
}

/** The same, bound to a locale once for a page that formats many. */
export function counter(locale: string): (value: number) => string {
  const format = new Intl.NumberFormat(localeTag(locale));
  return (value) => format.format(value);
}
