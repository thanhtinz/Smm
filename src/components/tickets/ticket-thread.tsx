"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { replyTicketAction, setTicketStatusAction, type TicketState } from "@/app/actions/tickets";
import { recordSavedReplyUseAction } from "@/app/actions/admin/saved-replies";
import SubmitButton from "@/components/ui/submit-button";
import { Icon } from "@/components/icons";

export type ThreadMessage = {
  id: string;
  body: string;
  fromStaff: boolean;
  author: string;
  createdAt: string;
};

export type SavedReply = { id: string; title: string; body: string };

export default function TicketThread({
  ticketId,
  messages,
  status,
  isStaff,
  savedReplies = [],
  labels,
}: {
  ticketId: string;
  messages: ThreadMessage[];
  status: string;
  isStaff: boolean;
  /** Empty for a customer: these are the desk's words, not theirs. */
  savedReplies?: SavedReply[];
  labels: Record<string, string>;
}) {
  const [state, action] = useActionState<TicketState, FormData>(replyTicketAction, {});
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const closed = status === "closed";

  // The box is controlled now, so that a saved reply can be dropped into it.
  // That means emptying it after a successful post is this component's job:
  // React resets an uncontrolled form after an action and leaves a controlled
  // one exactly as it was, which would show the reply still sitting there
  // unsent next to its own copy in the thread above.
  useEffect(() => {
    if (state.ok) setBody("");
  }, [state]);

  // Inserted rather than substituted: a saved reply is the bones of an answer,
  // and the half-sentence already typed about this particular customer is the
  // part that makes it one. Appending keeps both.
  const insert = (reply: SavedReply) => {
    setBody((current) => (current.trim() ? `${current.replace(/\s+$/, "")}\n\n${reply.body}` : reply.body));
    start(async () => {
      await recordSavedReplyUseAction(reply.id);
    });
  };

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
              <span className="muted ms-auto text-xs">{m.createdAt}</span>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="body" className="label">
                {labels.reply}
              </label>
              {isStaff && savedReplies.length > 0 && (
                <div>
                  <label htmlFor="savedReply" className="sr-only">
                    {labels.savedReply}
                  </label>
                  <select
                    id="savedReply"
                    // Reset to the placeholder after each pick, so choosing the
                    // same reply twice — for two questions in one ticket —
                    // still fires a change event.
                    value=""
                    onChange={(e) => {
                      const reply = savedReplies.find((r) => r.id === e.target.value);
                      if (reply) insert(reply);
                    }}
                    className="field w-auto py-1.5 text-xs"
                  >
                    <option value="">{labels.savedReply}</option>
                    {savedReplies.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <textarea
              id="body"
              name="body"
              rows={4}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
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
