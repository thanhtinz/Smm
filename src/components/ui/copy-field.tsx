"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

/**
 * A value the payer has to reproduce exactly. Copying it is the primary
 * action, so it is a button rather than something to select by hand.
 */
export default function CopyField({
  label,
  value,
  copyLabel,
  copiedLabel,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  copyLabel: string;
  copiedLabel: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be denied; the value stays selectable either way.
    }
  };

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 ${
        highlight
          ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]"
          : "border-[var(--border)]"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="muted text-[0.68rem] font-semibold tracking-widest uppercase">{label}</p>
        <p className={`mt-0.5 truncate text-sm font-semibold ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
      <button type="button" onClick={copy} className="btn btn-ghost btn-sm shrink-0" aria-label={`${copyLabel} ${label}`}>
        <Icon name={copied ? "check" : "copy"} size={15} />
        <span className="hidden sm:inline">{copied ? copiedLabel : copyLabel}</span>
      </button>
    </div>
  );
}
