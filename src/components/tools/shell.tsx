"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

/**
 * The furniture every tool shares.
 *
 * Kept in one place because fifteen tools each inventing their own copy
 * button is fifteen chances for one of them to behave differently.
 */

/** Every tool is handed one flat bag of strings; see the tool page. */
export type ToolLabels = Record<string, string>;

export function CopyButton({ value, labels }: { value: string; labels: ToolLabels }) {
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      disabled={!value}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="btn btn-ghost btn-sm"
    >
      <Icon name={done ? "check" : "copy"} size={15} />
      {done ? labels.copied : labels.copy}
    </button>
  );
}

/** A read-only result panel with a copy button in its corner. */
export function Output({
  value,
  label,
  labels,
  mono = true,
  error,
}: {
  value: string;
  label: string;
  labels: ToolLabels;
  mono?: boolean;
  error?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="muted text-xs font-semibold tracking-wide uppercase">{label}</span>
        {!error && <CopyButton value={value} labels={labels} />}
      </div>

      {error ? (
        <p className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </p>
      ) : (
        <pre
          className={`surface-2 max-h-96 overflow-auto rounded-[var(--radius)] p-4 text-sm whitespace-pre-wrap ${
            mono ? "font-mono" : ""
          }`}
        >
          {value}
        </pre>
      )}
    </div>
  );
}

export function Labelled({
  htmlFor,
  label,
  children,
}: {
  htmlFor: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="muted mb-1.5 block text-xs font-semibold tracking-wide uppercase">
        {label}
      </label>
      {children}
    </div>
  );
}
