"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";

export type ComboOption = {
  value: string;
  label: string;
  /** Short leading code, e.g. the service id. */
  code?: string;
  /** Right-aligned secondary text, e.g. the rate. */
  meta?: string;
  /** Extra text matched by the filter but not displayed. */
  keywords?: string;
};

/**
 * Searchable single-select. A native <select> stops being usable past a few
 * dozen entries, and a real catalogue runs to hundreds of services — so the
 * list is filtered as you type and driven entirely from the keyboard.
 */
export default function Combobox({
  name,
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  disabled,
  disabledLabel,
  invalid,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  disabled?: boolean;
  disabledLabel?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      `${o.code ?? ""} ${o.label} ${o.keywords ?? ""}`.toLowerCase().includes(q)
    );
  }, [options, query]);

  useEffect(() => {
    setCursor(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery("");
  }, [open]);

  // Keep the highlighted row inside the scroll viewport.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[cursor] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor, open]);

  const commit = (option: ComboOption) => {
    onChange(option.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = filtered[cursor];
      if (option) commit(option);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <input type="hidden" name={name} value={value} />

      <button
        type="button"
        id={name}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-invalid={invalid || undefined}
        className="field flex items-center justify-between gap-2 text-left"
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? "" : "muted"}`}>
          {disabled ? disabledLabel : selected ? selected.label : placeholder}
        </span>
        {selected?.meta && <span className="shrink-0 text-xs font-semibold tabular-nums">{selected.meta}</span>}
        <Icon name="chevronDown" size={15} />
      </button>

      {open && !disabled && (
        <div className="card absolute z-50 mt-1.5 w-full overflow-hidden shadow-2xl">
          <div className="relative border-b border-[var(--border)]">
            <span className="muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
              <Icon name="search" size={15} />
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent py-2.5 pr-3 pl-9 text-sm outline-none"
              autoComplete="off"
              role="combobox"
              aria-expanded
              aria-controls={listId}
            />
          </div>

          {filtered.length === 0 ? (
            <p className="muted px-3 py-6 text-center text-sm">{emptyLabel}</p>
          ) : (
            <ul id={listId} ref={listRef} role="listbox" className="max-h-72 overflow-y-auto py-1">
              {filtered.map((o, i) => (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={o.value === value}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => commit(o)}
                  className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm ${
                    i === cursor ? "bg-[var(--surface2)]" : ""
                  }`}
                >
                  {o.code && <span className="muted shrink-0 font-mono text-xs">{o.code}</span>}
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.meta && <span className="shrink-0 text-xs font-semibold tabular-nums">{o.meta}</span>}
                  {o.value === value && <Icon name="check" size={14} />}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
