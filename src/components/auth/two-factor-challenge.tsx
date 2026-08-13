"use client";

import { useActionState } from "react";
import { cancelPendingLoginAction, submitCodeAction, type ChallengeState } from "@/app/actions/two-factor";
import { Field, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/icons";
import SubmitButton from "@/components/ui/submit-button";

export default function TwoFactorChallenge({
  username,
  recoveryLeft,
  labels,
}: {
  username: string;
  /** Recovery codes still unused, so a locked-out admin knows where they stand. */
  recoveryLeft: number;
  labels: Record<"title" | "sub" | "code" | "codeHint" | "submit" | "cancel" | "recoveryLeft" | "noRecovery", string>;
}) {
  const [state, action] = useActionState<ChallengeState, FormData>(submitCodeAction, {});

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{labels.title}</h1>
      <p className="muted mt-2 text-sm">{labels.sub.replace("{user}", username)}</p>

      {state.error && (
        <div className="alert alert-danger mt-6" role="alert">
          <Icon name="alert" size={16} />
          <span>{state.error}</span>
        </div>
      )}

      <form action={action} className="mt-6 space-y-4" noValidate>
        <Field name="code" label={labels.code} hint={labels.codeHint} required>
          <TextInput
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="000000"
            className="text-center font-mono text-lg tracking-[0.4em]"
            hint={labels.codeHint}
          />
        </Field>

        <SubmitButton className="btn btn-primary w-full">
          <Icon name="shield" size={16} />
          {labels.submit}
        </SubmitButton>
      </form>

      <p className="muted mt-4 text-center text-xs">
        {recoveryLeft > 0 ? labels.recoveryLeft.replace("{count}", String(recoveryLeft)) : labels.noRecovery}
      </p>

      <form action={cancelPendingLoginAction} className="mt-4 text-center">
        <button type="submit" className="muted text-sm hover:text-[var(--text)]">
          {labels.cancel}
        </button>
      </form>
    </>
  );
}
