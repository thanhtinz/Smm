"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";

export type SearchOption = {
  value: string;
  label: string;
  /** The service's own number, which is what regulars quote. */
  code: string;
  /** Right-aligned secondary text: the price. */
  meta: string;
  keywords?: string;
};

/**
 * A search box, not a picker.
 *
 * The difference matters. The cascade below already picks — this is for the
 * customer who knows the name and wants to type it, and that means an input
 * they can type into on sight, with matches appearing underneath. A control
 * that has to be opened first, and only then offers a search field, is a
 * dropdown wearing a search label: two clicks before a single character.
 */
export default function ServiceSearch({
  options,
  onPick,
  placeholder,
  emptyLabel,
}: {
  options: SearchOption[];
  onPick: (value: string) => void;
  placeholder: string;
  emptyLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return options
      .filter(
        (o) =>
          o.label.toLowerCase().includes(needle) ||
          o.code.includes(needle) ||
          (o.keywords ?? "").toLowerCase().includes(needle),
      )
      // Enough to choose from without becoming a page of its own.
      .slice(0, 8);
  }, [options, query]);

  useEffect(() => setActive(0), [query]);

  // Clicking away closes it; the input keeps whatever was typed so a customer
  // who looked at something else can carry on.
  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const choose = (value: string) => {
    onPick(value);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={box} className="relative">
      <span className="muted pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2">
        <Icon name="search" size={16} />
      </span>
      <input
        // The id the wrapping <Field name="quickFind"> emits htmlFor for.
        // Without it the label was inert — clicking it did nothing, and the
        // input's only accessible name was its placeholder, on the control a
        // returning customer uses first.
        id="quickFind"
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!matches.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % matches.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i - 1 + matches.length) % matches.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            choose(matches[active].value);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className="field pl-11"
        role="combobox"
        aria-expanded={open && query.trim().length > 0}
        aria-controls="service-search-results"
        autoComplete="off"
      />

      {open && query.trim().length > 0 && (
        <ul
          id="service-search-results"
          role="listbox"
          className="popover absolute z-30 mt-1.5 max-h-80 w-full overflow-auto py-1 shadow-xl"
        >
          {matches.length === 0 ? (
            <li className="muted px-3.5 py-3 text-sm">{emptyLabel}</li>
          ) : (
            matches.map((option, i) => (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(option.value)}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm ${
                    i === active ? "bg-[var(--surface2)]" : ""
                  }`}
                >
                  <span className="muted shrink-0 font-mono text-xs">#{option.code}</span>
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  <span className="shrink-0 font-mono text-xs font-semibold tabular-nums">{option.meta}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
