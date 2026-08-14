"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { replyAction, setThreadStatusAction, type ActionResult } from "@/app/actions/admin/inbox";
import SubmitButton from "@/components/ui/submit-button";
import { Icon } from "@/components/icons";

export type ThreadMessage = {
  id: string;
  direction: string;
  body: string;
  author: string;
  createdAt: string;
};

/**
 * One conversation.
 *
 * Laid out as a chat rather than a ticket thread because that is what it is
 * on the other end — the customer is in Telegram, and a reply that reads like
 * a support form would land oddly beside their own messages.
 */
export default function Thread({
  conversationId,
  status,
  messages,
  labels,
}: {
  conversationId: string;
  status: string;
  messages: ThreadMessage[];
  /** Named by the caller: a client component has no dictionary of its own. */
  labels: Record<string, string>;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(replyAction, {});
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // A sent reply clears the box; leaving the text there invites sending it twice.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const closed = status === "closed";

  return (
    <div className="space-y-4">
      <div className="card max-h-[28rem] space-y-3 overflow-y-auto p-5">
        {messages.length === 0 ? (
          <p className="muted py-8 text-center text-sm">{labels.empty}</p>
        ) : (
          messages.map((m) => {
            const outgoing = m.direction === "out";
            return (
              <div key={m.id} className={`flex ${outgoing ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-[var(--radius)] px-4 py-2.5 ${outgoing ? "bg-[var(--primary)] text-[var(--primary-fg)]" : "surface-2"}`}>
                  <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                  <p className={`mt-1 text-[0.68rem] ${outgoing ? "opacity-75" : "muted"}`}>
                    {outgoing && m.author ? `${m.author} · ` : ""}
                    {m.createdAt}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {state.error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{state.error}</span>
        </div>
      )}

      <form ref={formRef} action={action} className="space-y-3">
        <input type="hidden" name="conversationId" value={conversationId} />
        <label htmlFor="inbox-body" className="sr-only">
          {labels.reply}
        </label>
        <textarea
          id="inbox-body"
          name="body"
          rows={3}
          className="field"
          placeholder={labels.reply}
          aria-invalid={Boolean(state.fieldErrors?.body) || undefined}
        />
        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton className="btn btn-primary">
            <Icon name="send" size={16} />
            {labels.send}
          </SubmitButton>
          <button
            type="button"
            disabled={pending}
            onClick={() => start(() => void setThreadStatusAction(conversationId, closed ? "open" : "closed"))}
            className="btn btn-ghost"
          >
            <Icon name={closed ? "refresh" : "check"} size={16} />
            {closed ? labels.reopen : labels.close}
          </button>
        </div>
      </form>
    </div>
  );
}
