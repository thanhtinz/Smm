"use client";

import { useEffect, useState, useTransition } from "react";
import { setCurrency, setDirection, setLocale, setTheme, setTimezone } from "@/app/actions/preferences";
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
  direction,
  languageDirection,
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
  /** The reader's own override — blank means they follow the language. */
  direction: string;
  /** What blank resolves to, so "follow the language" can be applied at once. */
  languageDirection: string;
  /** Pre-described on the server: the offsets need no client clock. */
  zones: { value: string; label: string }[];
  /** Each is off when the panel pins that choice for everyone. */
  allowLocale: boolean;
  allowCurrency: boolean;
  allowTheme: boolean;
  allowTimezone: boolean;
  labels: Record<
    | "title"
    | "language"
    | "currency"
    | "theme"
    | "timezone"
    | "timezoneHint"
    | "direction"
    | "directionHint"
    | "directionAuto"
    | "directionLtr"
    | "directionRtl"
    | "fixed",
    string
  >;
}) {
  const [pending, start] = useTransition();

  // Chosen here as well as on the server, and written to <html> from an
  // effect rather than from the change handler.
  //
  // revalidatePath re-renders the root layout, and React does not patch `dir`
  // on <html> the way it patches `data-theme`: the attribute came off the
  // element entirely and the page stayed left-to-right until a full reload.
  // Setting it in the handler lost the race with that re-render. An effect
  // runs after it, so the attribute is put back whichever order they land in.
  const [chosen, setChosen] = useState(direction);
  useEffect(() => setChosen(direction), [direction]);
  useEffect(() => {
    document.documentElement.dir = chosen || languageDirection || "ltr";
  }, [chosen, languageDirection, pending]);
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

          {allowLocale && (
            // Beside the language, because it is the language's property that
            // this overrides — Arabic and Urdu are laid out right to left and
            // everything else left to right, and "follow the language" is the
            // setting nearly every reader should stay on. It is here for the
            // bilingual reader who wants the interface running the way they
            // read rather than the way the language they picked is written.
            <Field name="direction" label={labels.direction} hint={labels.directionHint}>
              <select
                id="direction"
                name="direction"
                className="field"
                value={chosen}
                disabled={pending}
                onChange={(e) => {
                  const next = e.target.value;
                  setChosen(next);
                  start(() => setDirection(next));
                }}
              >
                <option value="">{labels.directionAuto}</option>
                <option value="ltr">{labels.directionLtr}</option>
                <option value="rtl">{labels.directionRtl}</option>
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
