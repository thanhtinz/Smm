"use client";

import { useState, useTransition } from "react";
import { setTicketPriorityAction } from "@/app/actions/tickets";
import { Icon } from "@/components/icons";

/**
 * Triage, on the ticket itself.
 *
 * A select rather than four buttons because this is one value with four
 * settings, and because support changes it while reading the thread — the
 * control should take one click and not move anything else on the page.
 */
export default function PriorityPicker({
  ticketId,
  value,
  labels,
  options,
}: {
  ticketId: string;
  value: string;
  /** Named by the caller: a client component has no dictionary of its own. */
  labels: { title: string; saved: string };
  options: { key: string; label: string }[];
}) {
  const [current, setCurrent] = useState(value);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function change(next: string) {
    const previous = current;
    setCurrent(next);
    setSaved(false);
    setError("");
    start(async () => {
      const result = await setTicketPriorityAction(ticketId, next);
      if (result.error) {
        // Put the control back where it was: leaving it showing a value the
        // server refused would be a lie about the queue.
        setCurrent(previous);
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <label htmlFor="ticket-priority" className="muted text-sm">
        {labels.title}
      </label>
      <select
        id="ticket-priority"
        className="field w-auto"
        value={current}
        disabled={pending}
        onChange={(e) => change(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>

      {saved && !pending && (
        <span className="flex items-center gap-1.5 text-sm text-[var(--success)]">
          <Icon name="check" size={15} />
          {labels.saved}
        </span>
      )}
      {error && (
        <span className="flex items-center gap-1.5 text-sm text-[var(--danger)]" role="alert">
          <Icon name="alert" size={15} />
          {error}
        </span>
      )}
    </div>
  );
}
