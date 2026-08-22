"use client";

import { Icon } from "@/components/icons";

/**
 * Reloads whatever the reader was actually trying to reach.
 *
 * A link back to the panel would not do: this page was served in place of a
 * navigation that failed, so the address bar still holds the page they asked
 * for and reloading is what retries it.
 */
export default function RetryButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.location.reload()} className="btn btn-primary mt-7">
      <Icon name="refresh" size={16} />
      {label}
    </button>
  );
}
