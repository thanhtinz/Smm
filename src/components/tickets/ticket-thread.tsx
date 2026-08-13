"use client";

import { useActionState, useState, useTransition } from "react";
import { replyTicketAction, setTicketStatusAction, type TicketState } from "@/app/actions/tickets";
import SubmitButton from "@/components/ui/submit-button";
import { Icon } from "@/components/icons";

export type ThreadMessage = {
  id: string;
  body: string;
  fromStaff: boolean;
  author: string;
  createdAt: string;
};

export default function TicketThread({
  ticketId,
  messages,
  status,
  isStaff,
  labels,
}: {
  ticketId: string;
  messages: ThreadMessage[];
  status: string;
  isStaff: boolean;
  labels: Record<string, string>;
}) {
  const [state, action] = useActionState<TicketState, FormData>(replyTicketAction, {});
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const closed = status === "closed";

  const setStatus = (next: string) => {
    setError("");
    start(async () => {
      const result = await setTicketStatusAction(ticketId, next);
      if (result.error) setError(result.error);
    });
  };

  return (
    <>
      <ol className="space-y-3">
        {messages.map((m) => (
          <li
            key={m.id}
            className={`card card-pad ${
              m.fromStaff ? "border-[color-mix(in_srgb,var(--primary)_35%,var(--border))]" : ""
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[0.65rem] font-bold ${
                  m.fromStaff
                    ? "bg-[color-mix(in_srgb,var(--primary)_22%,transparent)] text-[var(--primary)]"
                    : "surface-2 muted"
                }`}
              >
                {m.author.slice(0, 2).toUpperCase()}
              </span>
              <span className="text-sm font-semibold">{m.author}</span>
              {m.fromStaff && <span className="badge badge-info">{labels.staff}</span>}
              <span className="muted ml-auto text-xs">{m.createdAt}</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">{m.body}</p>
          </li>
        ))}
      </ol>

      {error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      {closed ? (
        <div className="card card-pad flex flex-wrap items-center justify-between gap-3">
          <span className="muted flex items-center gap-2 text-sm">
            <Icon name="lock" size={16} />
            {labels.closedNote}
          </span>
          {isStaff && (
            <button type="button" onClick={() => setStatus("open")} disabled={pending} className="btn btn-ghost btn-sm">
              <Icon name="refresh" size={14} />
              {labels.reopen}
            </button>
          )}
        </div>
      ) : (
        <form action={action} className="card card-pad space-y-3">
          {state.error && (
            <div className="alert alert-danger" role="alert">
              <Icon name="alert" size={16} />
              <span>{state.error}</span>
            </div>
          )}

          <input type="hidden" name="ticketId" value={ticketId} />

          <div>
            <label htmlFor="body" className="label">
              {labels.reply}
            </label>
            <textarea
              id="body"
              name="body"
              rows={4}
              required
              className="field"
              aria-invalid={state.fieldErrors?.body ? true : undefined}
            />
            {state.fieldErrors?.body && (
              <p className="form-error" role="alert">
                <Icon name="alert" size={14} />
                <span>{state.fieldErrors.body}</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <SubmitButton className="btn btn-primary">
              <Icon name="send" size={16} />
              {labels.send}
            </SubmitButton>
            <button
              type="button"
              onClick={() => setStatus("closed")}
              disabled={pending}
              className="btn btn-ghost btn-sm"
            >
              <Icon name="check" size={14} />
              {labels.close}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
