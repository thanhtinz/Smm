"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Icon, type IconName } from "@/components/icons";
import { setColorMode, setCurrency, setLocale, setTheme } from "@/app/actions/preferences";

type Option = { value: string; label: string; hint?: string };

function Popover({
  icon,
  label,
  options,
  active,
  onPick,
  align = "right",
}: {
  icon: IconName;
  label: string;
  options: Option[];
  active: string;
  onPick: (value: string) => void;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = options.find((o) => o.value === active);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="btn btn-ghost btn-sm ring-focus"
        disabled={pending}
      >
        <Icon name={icon} size={16} />
        <span className="hidden sm:inline">{current?.label ?? label}</span>
        <Icon name="chevronDown" size={13} />
      </button>
      {open && (
        <div
          className={`card absolute z-50 mt-2 min-w-52 overflow-hidden p-1.5 shadow-2xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
          role="listbox"
        >
          <p className="muted px-2.5 pt-1.5 pb-2 text-[0.68rem] font-semibold tracking-widest uppercase">{label}</p>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === active}
              onClick={() => {
                setOpen(false);
                start(() => onPick(o.value));
              }}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-[var(--surface2)]"
            >
              <span className="flex flex-col">
                <span>{o.label}</span>
                {o.hint && <span className="muted text-[0.7rem]">{o.hint}</span>}
              </span>
              {o.value === active && <Icon name="check" size={15} />}
            </button>
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
  showTheme = true,
}: {
  languages: { code: string; nativeName: string; name: string }[];
  currencies: { code: string; name: string; symbol: string }[];
  themes: { slug: string; name: string; description: string }[];
  locale: string;
  currency: string;
  theme: string;
  mode: "dark" | "light";
  showTheme?: boolean;
}) {
  const [, start] = useTransition();

  return (
    <div className="flex items-center gap-1.5">
      <Popover
        icon="language"
        label="Language"
        active={locale}
        options={languages.map((l) => ({ value: l.code, label: l.nativeName, hint: l.name }))}
        onPick={(v) => setLocale(v)}
      />
      <Popover
        icon="wallet"
        label="Currency"
        active={currency}
        options={currencies.map((c) => ({ value: c.code, label: `${c.code} ${c.symbol}`, hint: c.name }))}
        onPick={(v) => setCurrency(v)}
      />
      {showTheme && (
        <Popover
          icon="palette"
          label="Theme"
          active={theme}
          options={themes.map((t) => ({ value: t.slug, label: t.name, hint: t.description }))}
          onPick={(v) => setTheme(v)}
        />
      )}
      <button
        type="button"
        aria-label="Toggle colour mode"
        className="btn btn-ghost btn-sm ring-focus"
        onClick={() => start(() => setColorMode(mode === "dark" ? "light" : "dark"))}
      >
        <Icon name={mode === "dark" ? "sun" : "moon"} size={16} />
      </button>
    </div>
  );
}
