"use client";

import { useTransition } from "react";
import { setCurrency, setLocale, setTheme } from "@/app/actions/preferences";
import { Icon, type IconName } from "@/components/icons";

type Choice = { value: string; label: string; hint: string };

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
  allowLocale,
  allowCurrency,
  allowTheme,
  labels,
}: {
  languages: { code: string; nativeName: string; name: string }[];
  currencies: { code: string; name: string; symbol: string }[];
  themes: { slug: string; name: string; description: string }[];
  locale: string;
  currency: string;
  theme: string;
  /** Each is off when the panel pins that choice for everyone. */
  allowLocale: boolean;
  allowCurrency: boolean;
  allowTheme: boolean;
  labels: Record<"title" | "language" | "currency" | "theme" | "fixed", string>;
}) {
  const [pending, start] = useTransition();
  const anything = allowLocale || allowCurrency || allowTheme;

  return (
    <section className="card card-pad space-y-4">
      <h3 className="font-semibold">{labels.title}</h3>

      {!anything && <p className="muted text-sm">{labels.fixed}</p>}

      {allowLocale && (
        <Choices
          icon="language"
          label={labels.language}
          active={locale}
          disabled={pending}
          choices={languages.map((l) => ({ value: l.code, label: l.nativeName, hint: l.name }))}
          onPick={(v) => start(() => setLocale(v))}
        />
      )}

      {allowCurrency && (
        <Choices
          icon="wallet"
          label={labels.currency}
          active={currency}
          disabled={pending}
          choices={currencies.map((c) => ({ value: c.code, label: `${c.code} ${c.symbol}`, hint: c.name }))}
          onPick={(v) => start(() => setCurrency(v))}
        />
      )}

      {allowTheme && (
        <Choices
          icon="palette"
          label={labels.theme}
          active={theme}
          disabled={pending}
          choices={themes.map((t) => ({ value: t.slug, label: t.name, hint: t.description }))}
          onPick={(v) => start(() => setTheme(v))}
        />
      )}
    </section>
  );
}

/**
 * Cards rather than a select: there are only a handful of each, and the page
 * has the room to show what every option is without a click.
 */
function Choices({
  icon,
  label,
  choices,
  active,
  disabled,
  onPick,
}: {
  icon: IconName;
  label: string;
  choices: Choice[];
  active: string;
  disabled: boolean;
  onPick: (value: string) => void;
}) {
  return (
    <div>
      <span className="label flex items-center gap-1.5">
        <Icon name={icon} size={14} />
        {label}
      </span>
      <div className="grid gap-2 sm:grid-cols-2">
        {choices.map((c) => (
          <button
            key={c.value}
            type="button"
            disabled={disabled}
            aria-pressed={c.value === active}
            onClick={() => onPick(c.value)}
            className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
              c.value === active
                ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]"
                : "border-[var(--border)] hover:bg-[var(--surface2)]"
            }`}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{c.label}</span>
              <span className="muted block truncate text-xs">{c.hint}</span>
            </span>
            {c.value === active && (
              <span className="shrink-0 text-[var(--primary)]">
                <Icon name="check" size={16} />
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
