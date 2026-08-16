"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Icon, type IconName } from "@/components/icons";
import { setColorMode, setCurrency, setLocale, setTheme } from "@/app/actions/preferences";

type Option = { value: string; label: string; hint?: string };
type Group = { key: string; icon: IconName; label: string; options: Option[]; active: string; onPick: (v: string) => void };

function OptionList({
  group,
  onDone,
  showHeading,
}: {
  group: Group;
  onDone: () => void;
  showHeading: boolean;
}) {
  const [, start] = useTransition();
  return (
    <div role="listbox" aria-label={group.label}>
      {showHeading && (
        <p className="muted flex items-center gap-1.5 px-2.5 pt-2 pb-1.5 text-[0.68rem] font-semibold tracking-widest uppercase">
          <Icon name={group.icon} size={12} />
          {group.label}
        </p>
      )}
      {group.options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="option"
          aria-selected={o.value === group.active}
          onClick={() => {
            onDone();
            start(() => group.onPick(o.value));
          }}
          className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-[var(--surface2)]"
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{o.label}</span>
            {o.hint && <span className="muted truncate text-[0.7rem]">{o.hint}</span>}
          </span>
          {o.value === group.active && <Icon name="check" size={15} />}
        </button>
      ))}
    </div>
  );
}

/**
 * One popover holding every display choice.
 *
 * Three separate buttons, each wide enough to show its current value, took
 * more of the header than the choices are worth — a visitor sets these once
 * and never returns to them. The light/dark switch stays outside, because
 * that one is worth a single press.
 */
function PreferencesPopover({ groups, label }: { groups: Group[]; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = groups
    .map((g) => g.options.find((o) => o.value === g.active)?.label)
    .filter(Boolean)
    .slice(0, 2)
    .join(" · ");

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="btn btn-ghost btn-sm ring-focus"
      >
        <Icon name="settings" size={16} />
        <span className="hidden max-w-40 truncate lg:inline">{current}</span>
        <Icon name="chevronDown" size={13} />
      </button>

      {open && (
        <div className="popover absolute end-0 z-50 mt-2 max-h-[70vh] w-60 overflow-y-auto p-1.5 shadow-2xl">
          {groups.map((group, i) => (
            <div key={group.key} className={i > 0 ? "mt-1 border-t border-[var(--border)] pt-1" : ""}>
              <OptionList group={group} onDone={() => setOpen(false)} showHeading />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PreferenceMenu({
  languages,
  currencies,
  themes,
  locale,
  currency,
  theme,
  mode,
  labels,
  showTheme = true,
  showPickers = true,
  showMode = true,
  /** Laid out down the page instead of in a popover, for the mobile sheet. */
  stacked = false,
}: {
  languages: { code: string; nativeName: string; name: string }[];
  currencies: { code: string; name: string; symbol: string }[];
  themes: { slug: string; name: string; description: string }[];
  locale: string;
  currency: string;
  theme: string;
  mode: "dark" | "light";
  labels: { language: string; currency: string; theme: string; display: string; mode: string };
  /** Off where the panel also offers a theme picker in the account page. */
  showTheme?: boolean;
  /**
   * Off for a signed-in header: language, currency and theme are chosen in
   * the account page there, and only the light/dark switch stays here.
   */
  showPickers?: boolean;
  /**
   * Off on the landing page, whose colour mode belongs to the layout the
   * operator chose rather than to the reader. A switch that changes nothing
   * is worse than no switch.
   */
  showMode?: boolean;
  stacked?: boolean;
}) {
  const [, start] = useTransition();

  const groups: Group[] = [
    {
      key: "language",
      icon: "language",
      label: labels.language,
      active: locale,
      options: languages.map((l) => ({ value: l.code, label: l.nativeName, hint: l.name })),
      onPick: setLocale,
    },
    {
      key: "currency",
      icon: "wallet",
      label: labels.currency,
      active: currency,
      options: currencies.map((c) => ({ value: c.code, label: `${c.code} ${c.symbol}`, hint: c.name })),
      onPick: setCurrency,
    },
    ...(showTheme
      ? [
          {
            key: "theme",
            icon: "palette" as IconName,
            label: labels.theme,
            active: theme,
            options: themes.map((t) => ({ value: t.slug, label: t.name, hint: t.description })),
            onPick: setTheme,
          },
        ]
      : []),
  ];

  const toggle = (
    <button
      type="button"
      aria-label={labels.mode}
      className="btn btn-ghost btn-sm ring-focus"
      onClick={() => start(() => setColorMode(mode === "dark" ? "light" : "dark"))}
    >
      <Icon name={mode === "dark" ? "sun" : "moon"} size={16} />
      {stacked && <span>{labels.mode}</span>}
    </button>
  );

  if (stacked) {
    return (
      <div className="space-y-1">
        {showPickers &&
          groups.map((group) => <OptionList key={group.key} group={group} onDone={() => {}} showHeading />)}
        {showMode && toggle}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {showPickers && <PreferencesPopover groups={groups} label={labels.display} />}
      {showMode && toggle}
    </div>
  );
}
