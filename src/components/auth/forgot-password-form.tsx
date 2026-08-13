"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordResetAction, type ResetState } from "@/app/actions/password-reset";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import CaptchaField, { type CaptchaProps } from "@/components/auth/captcha-field";
import { Icon } from "@/components/icons";

export default function ForgotPasswordForm({
  captcha,
  labels,
}: {
  captcha: CaptchaProps | null;
  labels: Record<"title" | "sub" | "email" | "submit" | "sent" | "back", string>;
}) {
  const [state, action] = useActionState<ResetState, FormData>(requestPasswordResetAction, {});

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{labels.title}</h1>
      <p className="muted mt-2 text-sm">{labels.sub}</p>

      {state.sent ? (
        <div className="alert alert-success mt-6" role="status">
          <Icon name="checkCircle" size={16} />
          <span>{labels.sent}</span>
        </div>
      ) : (
        <form action={action} className="mt-6 space-y-4" noValidate>
          {state.error && (
            <div className="alert alert-danger" role="alert">
              <Icon name="alert" size={16} />
              <span>{state.error}</span>
            </div>
          )}

          <Field name="email" label={labels.email} error={state.fieldErrors?.email} required>
            <TextInput name="email" type="email" autoComplete="email" error={state.fieldErrors?.email} />
          </Field>

          {captcha && <CaptchaField config={captcha} />}

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
