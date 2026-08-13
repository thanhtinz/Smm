"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resendVerificationAction } from "@/app/actions/auth";
import type { FormState } from "@/app/actions/auth";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import { Icon } from "@/components/icons";

export default function ResendVerificationForm({
  email,
  labels,
}: {
  email: string;
  labels: Record<"title" | "sub" | "email" | "submit" | "sent" | "back", string>;
}) {
  const [state, action] = useActionState<FormState, FormData>(resendVerificationAction, {});

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{labels.title}</h1>
      <p className="muted mt-2 text-sm">{labels.sub}</p>

      {state.pendingVerification ? (
        <div className="alert alert-success mt-6" role="status">
          <Icon name="mail" size={16} />
          <span>{labels.sent.replace("{email}", state.pendingVerification)}</span>
        </div>
      ) : (
        <form action={action} className="mt-6 space-y-4" noValidate>
          <Field name="email" label={labels.email} error={state.fieldErrors?.email} required>
            <TextInput name="email" type="email" defaultValue={email} autoComplete="email" error={state.fieldErrors?.email} />
          </Field>
          <SubmitButton className="btn btn-primary w-full">
            <Icon name="mail" size={16} />
            {labels.submit}
          </SubmitButton>
        </form>
      )}

      <p className="muted mt-6 text-center text-sm">
        <Link href="/login" className="font-medium text-[var(--primary)] hover:underline">
          {labels.back}
        </Link>
      </p>
    </>
  );
}
