"use client";

import { useEffect, useMemo, useState } from "react";
import { Labelled, Output } from "./shell";
import type { ToolLabels } from "./marketing";

// ------------------------------------------------------------------ json

export function JsonTool({ labels }: { labels: ToolLabels }) {
  const [text, setText] = useState("");
  const [indent, setIndent] = useState(2);

  const { value, error } = useMemo(() => {
    if (!text.trim()) return { value: "", error: "" };
    try {
      return { value: JSON.stringify(JSON.parse(text), null, indent), error: "" };
    } catch (e) {
      // The parser's own message names the position, which is the only useful
      // thing to say about broken JSON.
      return { value: "", error: e instanceof Error ? e.message : String(e) };
    }
  }, [text, indent]);

  return (
    <div className="space-y-4">
      <Labelled htmlFor="json-in" label={labels.input}>
        <textarea
          id="json-in"
          rows={8}
          className="field font-mono text-xs"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='{"hello":"world"}'
        />
      </Labelled>

      <Labelled htmlFor="json-indent" label={labels.indent}>
        <select id="json-indent" className="field w-auto" value={indent} onChange={(e) => setIndent(Number(e.target.value))}>
          <option value={2}>2</option>
          <option value={4}>4</option>
          <option value={0}>0</option>
        </select>
      </Labelled>

      {text.trim() && <Output value={value} label={labels.result} labels={labels} error={error} />}
    </div>
  );
}

// ---------------------------------------------------------------- base64

/** Round-trips through UTF-8 bytes, so Vietnamese survives both directions. */
function encodeBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function decodeBase64(input: string): string {
  const binary = atob(input.trim());
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function Base64Tool({ labels }: { labels: ToolLabels }) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"encode" | "decode">("encode");

  const { value, error } = useMemo(() => {
    if (!text) return { value: "", error: "" };
    try {
      return { value: mode === "encode" ? encodeBase64(text) : decodeBase64(text), error: "" };
    } catch {
      return { value: "", error: labels.badBase64 };
    }
  }, [text, mode, labels.badBase64]);

  return (
    <div className="space-y-4">
      <ModeSwitch
        value={mode}
        onChange={setMode}
        options={[
          { key: "encode", label: labels.encode },
          { key: "decode", label: labels.decode },
        ]}
      />
      <Labelled htmlFor="b64-in" label={labels.input}>
        <textarea id="b64-in" rows={6} className="field font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} />
      </Labelled>
      {text && <Output value={value} label={labels.result} labels={labels} error={error} />}
    </div>
  );
}

export function UrlTool({ labels }: { labels: ToolLabels }) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"encode" | "decode">("encode");

  const { value, error } = useMemo(() => {
    if (!text) return { value: "", error: "" };
    try {
      return { value: mode === "encode" ? encodeURIComponent(text) : decodeURIComponent(text), error: "" };
    } catch {
      return { value: "", error: labels.badUrl };
    }
  }, [text, mode, labels.badUrl]);

  return (
    <div className="space-y-4">
      <ModeSwitch
        value={mode}
        onChange={setMode}
        options={[
          { key: "encode", label: labels.encode },
          { key: "decode", label: labels.decode },
        ]}
      />
      <Labelled htmlFor="url-in" label={labels.input}>
        <textarea id="url-in" rows={5} className="field font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} />
      </Labelled>
      {text && <Output value={value} label={labels.result} labels={labels} error={error} />}
    </div>
  );
}

// ------------------------------------------------------------------ hash

const ALGORITHMS = ["SHA-1", "SHA-256", "SHA-512"] as const;

export function HashTool({ labels }: { labels: ToolLabels }) {
  const [text, setText] = useState("");
  const [digests, setDigests] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!text) {
      setDigests({});
      return;
    }
    let live = true;
    const bytes = new TextEncoder().encode(text);
    Promise.all(
      ALGORITHMS.map(async (algo) => {
        const buffer = await crypto.subtle.digest(algo, bytes);
        const hex = [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
        return [algo, hex] as const;
      }),
    ).then((pairs) => live && setDigests(Object.fromEntries(pairs)));
    return () => {
      live = false;
    };
  }, [text]);

  return (
    <div className="space-y-4">
      <Labelled htmlFor="hash-in" label={labels.input}>
        <textarea id="hash-in" rows={4} className="field" value={text} onChange={(e) => setText(e.target.value)} />
      </Labelled>
      {ALGORITHMS.map((a) => digests[a] && <Output key={a} value={digests[a]} label={a} labels={labels} />)}
    </div>
  );
}

// ------------------------------------------------------------- timestamp

export function TimestampTool({ labels, locale }: { labels: ToolLabels; locale: string }) {
  const [value, setValue] = useState("");

  const parsed = useMemo(() => {
    const raw = value.trim();
    if (!raw) return null;

    // Ten digits is seconds, thirteen is milliseconds — the two shapes every
    // API in this business uses.
    if (/^\d+$/.test(raw)) {
      const n = Number(raw);
      const ms = raw.length <= 10 ? n * 1000 : n;
      const date = new Date(ms);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }, [value]);

  return (
    <div className="space-y-4">
      <Labelled htmlFor="ts-in" label={labels.input}>
        <input
          id="ts-in"
          className="field font-mono"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="1767225600"
          aria-invalid={(value.trim() && !parsed) || undefined}
        />
      </Labelled>

      {parsed && (
        <>
          <Output value={String(Math.floor(parsed.getTime() / 1000))} label="Unix (s)" labels={labels} />
          <Output value={parsed.toISOString()} label="ISO 8601" labels={labels} />
          <Output value={parsed.toLocaleString(locale === "vi" ? "vi-VN" : locale)} label={labels.local} labels={labels} />
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- color

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace(/^#/, "").trim();
  const full = clean.length === 3 ? [...clean].map((c) => c + c).join("") : clean;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [full.slice(0, 2), full.slice(2, 4), full.slice(4, 6)].map((p) => parseInt(p, 16)) as [number, number, number];
}

function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === rn ? ((gn - bn) / d + (gn < bn ? 6 : 0)) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return [Math.round(h * 60), Math.round(s * 100), Math.round(l * 100)];
}

export function ColorTool({ labels }: { labels: ToolLabels }) {
  const [hex, setHex] = useState("#8b5cf6");
  const rgb = hexToRgb(hex);
  const hsl = rgb ? rgbToHsl(rgb) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Labelled htmlFor="color-in" label="HEX">
            <input
              id="color-in"
              className="field font-mono"
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              aria-invalid={!rgb || undefined}
            />
          </Labelled>
        </div>
        <span
          className="h-11 w-16 shrink-0 rounded-[var(--radius)] border border-[var(--border)]"
          style={{ background: rgb ? hex : "transparent" }}
        />
      </div>

      {rgb && hsl && (
        <>
          <Output value={`rgb(${rgb.join(", ")})`} label="RGB" labels={labels} />
          <Output value={`hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)`} label="HSL" labels={labels} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- shared

function ModeSwitch<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string }[];
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
            value === o.key ? "bg-[var(--primary)] text-[var(--primary-fg)]" : "surface-2 muted hover:text-[var(--text)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
