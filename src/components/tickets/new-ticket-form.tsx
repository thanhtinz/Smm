"use client";

import { useActionState } from "react";
import { createTicketAction, type TicketState } from "@/app/actions/tickets";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import { Icon } from "@/components/icons";

export default function NewTicketForm({
  categories,
  attachments = null,
  labels,
}: {
  categories: string[];
  /** Null when the operator has attachments switched off. */
  attachments?: { maxFiles: number; maxKb: number } | null;
  labels: Record<string, string>;
}) {
  const [state, action] = useActionState<TicketState, FormData>(createTicketAction, {});

  return (
    <form action={action} className="card card-pad space-y-4" noValidate>
      {state.error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{state.error}</span>
        </div>
      )}

      <Field name="category" label={labels.category}>
        {/* defaultValue rather than value: React resets the form once the
            action returns, and a refusal hands back what was typed so the
            reset lands on it instead of on empty. */}
        <select id="category" name="category" className="field" defaultValue={state.values?.category ?? categories[0]}>
          {categories.map((c) => (
            <option key={c} value={c}>
              {labels[`category.${c}`] ?? c}
            </option>
          ))}
        </select>
      </Field>

      <Field name="subject" label={labels.subject} error={state.fieldErrors?.subject} required>
        <TextInput name="subject" defaultValue={state.values?.subject ?? ""} error={state.fieldErrors?.subject} autoFocus />
      </Field>

      <div>
        <label htmlFor="body" className="label">
          {labels.message} <span className="text-[var(--danger)]">*</span>
        </label>
        <textarea
          id="body"
          name="body"
          rows={6}
          defaultValue={state.values?.body ?? ""}
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

      {attachments && (
        <div>
          <label htmlFor="files" className="label">
            {labels.attach}
          </label>
          <input
            id="files"
            type="file"
            name="files"
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
            className="field"
          />
          {/* A file input cannot be refilled from script, so a refused post
              always costs the picking again. Saying so beats a hint that is
              only true the first time. */}
          <p className="muted mt-1 text-xs">{state.error ? labels.attachAgain : labels.attachHint}</p>
        </div>
      )}

      <SubmitButton className="btn btn-primary">
        <Icon name="send" size={16} />
        {labels.submit}
      </SubmitButton>
    </form>
  );
}
