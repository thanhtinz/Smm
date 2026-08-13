"use client";

import { useActionState } from "react";
import { createTicketAction, type TicketState } from "@/app/actions/tickets";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import { Icon } from "@/components/icons";

export default function NewTicketForm({
  categories,
  labels,
}: {
  categories: string[];
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
        <select id="category" name="category" className="field" defaultValue={categories[0]}>
          {categories.map((c) => (
            <option key={c} value={c}>
              {labels[`category.${c}`] ?? c}
            </option>
          ))}
        </select>
      </Field>

      <Field name="subject" label={labels.subject} error={state.fieldErrors?.subject} required>
        <TextInput name="subject" error={state.fieldErrors?.subject} autoFocus />
      </Field>

      <div>
        <label htmlFor="body" className="label">
          {labels.message} <span className="text-[var(--danger)]">*</span>
        </label>
        <textarea
          id="body"
          name="body"
          rows={6}
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

      <SubmitButton className="btn btn-primary">
        <Icon name="send" size={16} />
        {labels.submit}
      </SubmitButton>
    </form>
  );
}
