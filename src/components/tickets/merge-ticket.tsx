"use client";

import { useState, useTransition } from "react";
import { mergeTicketAction } from "@/app/actions/tickets";
import { Icon } from "@/components/icons";

/**
 * Folding a duplicate into the real ticket.
 *
 * Customers open a second ticket when the first one goes quiet, so support
 * ends up answering the same question in two threads. This moves the
 * messages into one of them.
 *
 * The list only ever holds this customer's other tickets — the server checks
 * that too, because a merge across two customers would show each of them the
 * other's messages.
 */
export default function MergeTicket({
  ticketId,
  candidates,
  labels,
}: {
  ticketId: string;
  candidates: { id: string; label: string }[];
  /** Named by the caller: a client component has no dictionary of its own. */
  labels: { title: string; none: string; action: string; confirm: string; hint: string };
}) {
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (!candidates.length) {
    return (
      <p className="muted text-sm">
        {labels.title}: {labels.none}
      </p>
    );
  }

  function merge() {
    if (!target || !confirm(labels.confirm)) return;
    setError("");
    start(async () => {
      const result = await mergeTicketAction(ticketId, target);
      if (result.error) setError(result.error);
      // No success branch: a merge closes this ticket, and the page it is on
      // re-renders showing where the conversation went.
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2.5">
        <label htmlFor="merge-target" className="muted text-sm">
          {labels.title}
        </label>
        <select
          id="merge-target"
          className="field w-auto"
          value={target}
          disabled={pending}
          onChange={(e) => setTarget(e.target.value)}
        >
          <option value="">—</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={merge} disabled={!target || pending} className="btn btn-ghost btn-sm">
          <Icon name="layers" size={15} />
          {labels.action}
        </button>
      </div>

      <p className="muted text-xs">{labels.hint}</p>

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-[var(--danger)]" role="alert">
          <Icon name="alert" size={15} />
          {error}
        </p>
      )}
    </div>
  );
}
