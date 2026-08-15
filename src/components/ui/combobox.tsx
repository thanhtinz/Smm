"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  /** Drawn before the label, in the trigger and in the list. */
  icon?: React.ReactNode;
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
  searchable = true,
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
  /**
   * A search field earns its place over dozens of entries and gets in the way
   * under a dozen, where the whole list is on screen already.
   */
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const [mounted, setMounted] = useState(false);
  const [box, setBox] = useState<{
    left: number;
    width: number;
    maxHeight: number;
    top?: number;
    bottom?: number;
  }>({ left: 0, width: 0, maxHeight: 320 });

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const GUTTER = 12;
      // Leave room for the fixed bottom bar on small screens.
      const reserved = window.innerWidth < 1024 ? 76 : GUTTER;
      const below = window.innerHeight - r.bottom - reserved;
      const above = r.top - GUTTER;
      const openUp = below < 220 && above > below;
      // When flipping upward, anchor by `bottom` so the panel hugs the trigger
      // regardless of how tall its contents turn out to be.
      setBox({
        left: r.left,
        width: r.width,
        maxHeight: Math.max(180, Math.min(360, (openUp ? above : below) - 6)),
        ...(openUp ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
      });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

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
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
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
        ref={triggerRef}
        type="button"
        id={name}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        // Without a search field there is no input to carry the arrow keys, so
        // the trigger does. A list you can only reach with a mouse is not one.
        onKeyDown={(e) => {
          if (searchable) return;
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setOpen(true);
            return;
          }
          if (open) onKeyDown(e);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-invalid={invalid || undefined}
        className="field flex items-center justify-between gap-2 text-left"
      >
        {selected?.icon && <span className="flex shrink-0 items-center">{selected.icon}</span>}
        <span className={`min-w-0 flex-1 truncate ${selected ? "" : "muted"}`}>
          {disabled ? disabledLabel : selected ? selected.label : placeholder}
        </span>
        {selected?.meta && <span className="shrink-0 text-xs font-semibold tabular-nums">{selected.meta}</span>}
        <Icon name="chevronDown" size={15} />
      </button>

      {open &&
        !disabled &&
        mounted &&
        createPortal(
          <div
            className="fixed z-[100] overflow-hidden rounded-[calc(var(--radius)*0.7)] border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
            style={{ top: box.top, bottom: box.bottom, left: box.left, width: box.width }}
            ref={panelRef}
          >
          {searchable && (
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
          )}

          {filtered.length === 0 ? (
            <p className="muted px-3 py-6 text-center text-sm">{emptyLabel}</p>
          ) : (
            <ul
              id={listId}
              ref={listRef}
              role="listbox"
              className="overflow-y-auto py-1"
              style={{ maxHeight: box.maxHeight - (searchable ? 46 : 4) }}
            >
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
                  {o.icon && <span className="flex shrink-0 items-center">{o.icon}</span>}
                  {o.code && <span className="muted shrink-0 font-mono text-xs">{o.code}</span>}
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.meta && <span className="shrink-0 text-xs font-semibold tabular-nums">{o.meta}</span>}
                  {o.value === value && <Icon name="check" size={14} />}
                </li>
              ))}
            </ul>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
