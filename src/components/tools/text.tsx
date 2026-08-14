"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { CopyButton, Labelled, Output } from "./shell";
import type { ToolLabels } from "./marketing";

// ------------------------------------------------------------------ case

const CASES = ["upper", "lower", "title", "sentence", "camel"] as const;
type Case = (typeof CASES)[number];

function convert(text: string, mode: Case): string {
  switch (mode) {
    case "upper":
      return text.toLocaleUpperCase();
    case "lower":
      return text.toLocaleLowerCase();
    case "title":
      return text.replace(/\p{L}[\p{L}\p{M}']*/gu, (w) => w[0].toLocaleUpperCase() + w.slice(1).toLocaleLowerCase());
    case "sentence":
      // A sentence ends at . ! ? — and the first letter after it is capital.
      return text
        .toLocaleLowerCase()
        .replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (_, lead, letter) => lead + letter.toLocaleUpperCase());
    case "camel": {
      const words = text.match(/\p{L}[\p{L}\p{M}\p{N}]*/gu) ?? [];
      return words
        .map((w, i) =>
          i === 0 ? w.toLocaleLowerCase() : w[0].toLocaleUpperCase() + w.slice(1).toLocaleLowerCase(),
        )
        .join("");
    }
  }
}

export function CaseTool({ labels }: { labels: ToolLabels }) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<Case>("upper");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {CASES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setMode(c)}
            aria-pressed={mode === c}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              mode === c ? "bg-[var(--primary)] text-[var(--primary-fg)]" : "surface-2 muted hover:text-[var(--text)]"
            }`}
          >
            {labels[`case.${c}`]}
          </button>
        ))}
      </div>

      <Labelled htmlFor="case-in" label={labels.input}>
        <textarea id="case-in" rows={6} className="field" value={text} onChange={(e) => setText(e.target.value)} />
      </Labelled>

      {text && <Output value={convert(text, mode)} label={labels.result} labels={labels} mono={false} />}
    </div>
  );
}

// ------------------------------------------------------------ word count

/** A middling Vietnamese reading pace; the figure is a guide, not a promise. */
const WORDS_PER_MINUTE = 200;

export function WordCountTool({ labels, locale }: { labels: ToolLabels; locale: string }) {
  const [text, setText] = useState("");
  const format = new Intl.NumberFormat(locale === "vi" ? "vi-VN" : locale);

  const stats = useMemo(() => {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return {
      words,
      characters: text.length,
      withoutSpaces: text.replace(/\s/g, "").length,
      lines: text ? text.split(/\r?\n/).length : 0,
      minutes: Math.max(words ? 1 : 0, Math.round(words / WORDS_PER_MINUTE)),
    };
  }, [text]);

  const tiles = [
    { k: labels["count.words"], v: stats.words },
    { k: labels["count.characters"], v: stats.characters },
    { k: labels["count.withoutSpaces"], v: stats.withoutSpaces },
    { k: labels["count.lines"], v: stats.lines },
  ];

  return (
    <div className="space-y-4">
      <Labelled htmlFor="wc-in" label={labels.input}>
        <textarea id="wc-in" rows={8} className="field" value={text} onChange={(e) => setText(e.target.value)} />
      </Labelled>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((s) => (
          <div key={s.k} className="surface-2 rounded-[var(--radius)] p-4">
            <dd className="font-mono text-2xl font-bold">{format.format(s.v)}</dd>
            <dt className="muted mt-1 text-xs">{s.k}</dt>
          </div>
        ))}
      </dl>

      {stats.words > 0 && (
        <p className="muted flex items-center gap-2 text-sm">
          <Icon name="clock" size={15} />
          {labels["count.reading"].replace("{n}", format.format(stats.minutes))}
        </p>
      )}
    </div>
  );
}

// -------------------------------------------------------------- password

const SETS = {
  lower: "abcdefghijkmnopqrstuvwxyz",
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  // l, I, O and 0 are left out of all four sets: these get read aloud and
  // typed by hand more often than anyone admits.
  digits: "23456789",
  symbols: "!@#$%^&*()-_=+[]{}",
};

export function PasswordTool({ labels }: { labels: ToolLabels }) {
  const [length, setLength] = useState(20);
  const [use, setUse] = useState({ lower: true, upper: true, digits: true, symbols: true });
  const [value, setValue] = useState("");

  function generate() {
    const pool = (Object.keys(SETS) as (keyof typeof SETS)[]).filter((k) => use[k]).map((k) => SETS[k]).join("");
    if (!pool) return setValue("");

    // crypto, not Math.random: this is a password, and the difference is the
    // whole point of generating one rather than typing one.
    const bytes = new Uint32Array(length);
    crypto.getRandomValues(bytes);
    setValue([...bytes].map((n) => pool[n % pool.length]).join(""));
  }

  return (
    <div className="space-y-4">
      <Labelled htmlFor="pw-len" label={`${labels["password.length"]} — ${length}`}>
        <input
          id="pw-len"
          type="range"
          min={8}
          max={64}
          value={length}
          onChange={(e) => setLength(Number(e.target.value))}
          className="w-full accent-[var(--primary)]"
        />
      </Labelled>

      <div className="flex flex-wrap gap-4">
        {(Object.keys(SETS) as (keyof typeof SETS)[]).map((k) => (
          <label key={k} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={use[k]}
              onChange={(e) => setUse({ ...use, [k]: e.target.checked })}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            {labels[`password.${k}`]}
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={generate} className="btn btn-primary">
          <Icon name="refresh" size={16} />
          {labels["password.generate"]}
        </button>
        {value && <CopyButton value={value} labels={labels} />}
      </div>

      {value && (
        <pre className="surface-2 rounded-[var(--radius)] p-4 font-mono text-lg break-all">{value}</pre>
      )}
    </div>
  );
}
