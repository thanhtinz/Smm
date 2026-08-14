"use client";

import { useTransition } from "react";
import { setCurrency, setLocale, setTheme, setTimezone } from "@/app/actions/preferences";
import { Field } from "@/components/ui/field";

/**
 * Language, currency and theme, chosen where the rest of the account is
 * managed. The light/dark switch is not here: it is a per-moment choice
 * rather than a setting, so it stays one press away in the header.
 */
export default function PreferencesPanel({
  languages,
  currencies,
  themes,
  locale,
  currency,
  theme,
  timezone,
  zones,
  allowLocale,
  allowCurrency,
  allowTheme,
  allowTimezone,
  labels,
}: {
  languages: { code: string; nativeName: string; name: string }[];
  currencies: { code: string; name: string; symbol: string }[];
  themes: { slug: string; name: string; description: string }[];
  locale: string;
  currency: string;
  theme: string;
  timezone: string;
  /** Pre-described on the server: the offsets need no client clock. */
  zones: { value: string; label: string }[];
  /** Each is off when the panel pins that choice for everyone. */
  allowLocale: boolean;
  allowCurrency: boolean;
  allowTheme: boolean;
  allowTimezone: boolean;
  labels: Record<"title" | "language" | "currency" | "theme" | "timezone" | "timezoneHint" | "fixed", string>;
}) {
  const [pending, start] = useTransition();
  const anything = allowLocale || allowCurrency || allowTheme || allowTimezone;

  return (
    <section className="card card-pad space-y-4">
      <h3 className="font-semibold">{labels.title}</h3>

      {!anything ? (
        <p className="muted text-sm">{labels.fixed}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {allowLocale && (
            <Field name="locale" label={labels.language}>
              <select
                id="locale"
                name="locale"
                className="field"
                value={locale}
                disabled={pending}
                onChange={(e) => start(() => setLocale(e.target.value))}
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.nativeName} — {l.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {allowCurrency && (
            <Field name="currency" label={labels.currency}>
              <select
                id="currency"
                name="currency"
                className="field"
                value={currency}
                disabled={pending}
                onChange={(e) => start(() => setCurrency(e.target.value))}
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} {c.symbol} — {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {allowTimezone && (
            // Every date on every page is rendered in this, so it belongs
            // beside the other display choices rather than buried.
            <Field name="timezone" label={labels.timezone} hint={labels.timezoneHint}>
              <select
                id="timezone"
                name="timezone"
                className="field"
                value={timezone}
                disabled={pending}
                onChange={(e) => start(() => setTimezone(e.target.value))}
              >
                {zones.map((z) => (
                  <option key={z.value} value={z.value}>
                    {z.label}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {allowTheme && (
            // The description follows the selection: a theme name alone does
            // not say what picking it does.
            <Field name="theme" label={labels.theme} hint={themes.find((t) => t.slug === theme)?.description}>
              <select
                id="theme"
                name="theme"
                className="field"
                value={theme}
                disabled={pending}
                onChange={(e) => start(() => setTheme(e.target.value))}
              >
                {themes.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      )}
    </section>
  );
}
