"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

/**
 * Copies a value and says so for a moment.
 *
 * Anywhere the panel shows something a person is meant to paste elsewhere —
 * a webhook address, an API key — the value is useless without this.
 */
export default function CopyButton({
  value,
  labels,
}: {
  value: string;
  /** Named by the caller: a client component has no dictionary of its own.
   *  A loose record so a caller can pass the one label bag it already has. */
  labels: Record<string, string>;
}) {
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
