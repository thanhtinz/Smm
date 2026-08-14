"use client";

import { useState } from "react";
import { Icon, Icons, type IconName } from "@/components/icons";

/**
 * Platforms pick their glyph from the project's own SVG set — the panel ships
 * no emoji and no icon font, so this is the whole available vocabulary.
 */
const CHOICES = Object.keys(Icons) as IconName[];

export default function IconPicker({
  name,
  value,
  color,
  label,
  searchLabel,
}: {
  name: string;
  value: string;
  color?: string;
  label: string;
  /** Passed in: a client component has no dictionary of its own. */
  searchLabel: string;
}) {
  const [selected, setSelected] = useState<string>(value);
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? CHOICES.filter((c) => c.toLowerCase().includes(query.trim().toLowerCase()))
    : CHOICES;

  return (
    <div>
      <span className="label">{label}</span>
      <input type="hidden" name={name} value={selected} />

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchLabel}
        className="field mb-2"
        aria-label={searchLabel}
      />

      <div className="grid max-h-44 grid-cols-8 gap-1.5 overflow-y-auto rounded-xl border border-[var(--border)] p-2">
        {filtered.map((key) => (
          <button
            key={key}
            type="button"
            title={key}
            aria-label={key}
            aria-pressed={key === selected}
            onClick={() => setSelected(key)}
            className={`flex aspect-square items-center justify-center rounded-lg transition-colors ${
              key === selected
                ? "bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] text-[var(--primary)]"
                : "muted hover:bg-[var(--surface2)]"
            }`}
            style={key === selected && color ? { color } : undefined}
          >
            <Icon name={key} size={17} />
          </button>
        ))}
      </div>
    </div>
  );
}
