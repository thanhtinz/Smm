"use client";

import { useActionState } from "react";
import { completePasswordResetAction, type ResetState } from "@/app/actions/password-reset";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import { Icon } from "@/components/icons";

export default function ResetPasswordForm({
  token,
  labels,
}: {
  token: string;
  labels: Record<"title" | "sub" | "password" | "confirm" | "submit", string>;
}) {
  const [state, action] = useActionState<ResetState, FormData>(completePasswordResetAction, {});

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{labels.title}</h1>
      <p className="muted mt-2 text-sm">{labels.sub}</p>

      <form action={action} className="mt-6 space-y-4" noValidate>
        {state.error && (
          <div className="alert alert-danger" role="alert">
            <Icon name="alert" size={16} />
            <span>{state.error}</span>
          </div>
        )}

        <input type="hidden" name="token" value={token} />

        <Field name="password" label={labels.password} error={state.fieldErrors?.password} required>
          <TextInput name="password" type="password" autoComplete="new-password" error={state.fieldErrors?.password} />
        </Field>
        <Field name="confirm" label={labels.confirm} error={state.fieldErrors?.confirm} required>
          <TextInput name="confirm" type="password" autoComplete="new-password" error={state.fieldErrors?.confirm} />
        </Field>

        <SubmitButton className="btn btn-primary w-full">
          <Icon name="check" size={16} />
          {labels.submit}
        </SubmitButton>
      </form>
    </>
  );
}
