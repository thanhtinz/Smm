"use client";

import { useState, useTransition } from "react";
import { setTicketAssigneeAction, setTicketPriorityAction } from "@/app/actions/tickets";
import { Icon } from "@/components/icons";

type Option = { key: string; label: string };

/**
 * Triage, on the ticket itself.
 *
 * Priority and owner are the two questions support answers about a ticket
 * without writing anything, so they sit together in one bar above the thread.
 * Selects rather than buttons: each is one value with a handful of settings,
 * and support changes them while reading, so the control should take one
 * click and move nothing else on the page.
 */
export default function TicketTriage({
  ticketId,
  priority,
  assignee,
  labels,
  priorities,
  staff,
}: {
  ticketId: string;
  priority: string;
  /** Empty string means nobody holds it. */
  assignee: string;
  /** Named by the caller: a client component has no dictionary of its own. */
  labels: { priority: string; assignee: string; nobody: string; saved: string };
  priorities: Option[];
  staff: Option[];
}) {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const [priorityValue, setPriorityValue] = useState(priority);
  const [assigneeValue, setAssigneeValue] = useState(assignee);

  function save(
    next: string,
    previous: string,
    apply: (v: string) => void,
    run: (v: string) => Promise<{ error?: string }>,
  ) {
    apply(next);
    setSaved(false);
    setError("");
    start(async () => {
      const result = await run(next);
      if (result.error) {
        // Put the control back: leaving it showing a value the server refused
        // would be a lie about the queue.
        apply(previous);
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex items-center gap-2.5">
        <label htmlFor="ticket-priority" className="muted text-sm">
          {labels.priority}
        </label>
        <select
          id="ticket-priority"
          className="field w-auto"
          value={priorityValue}
          disabled={pending}
          onChange={(e) =>
            save(e.target.value, priorityValue, setPriorityValue, (v) => setTicketPriorityAction(ticketId, v))
          }
        >
          {priorities.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2.5">
        <label htmlFor="ticket-assignee" className="muted text-sm">
          {labels.assignee}
        </label>
        <select
          id="ticket-assignee"
          className="field w-auto"
          value={assigneeValue}
          disabled={pending}
          onChange={(e) =>
            save(e.target.value, assigneeValue, setAssigneeValue, (v) => setTicketAssigneeAction(ticketId, v))
          }
        >
          {/* Handing a ticket back to the queue is a real choice, so "nobody"
              is an option rather than something only the database can say. */}
          <option value="">{labels.nobody}</option>
          {staff.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

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
