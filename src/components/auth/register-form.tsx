"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type FormState } from "@/app/actions/auth";
import { Field, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/icons";
import SubmitButton from "@/components/ui/submit-button";
import CaptchaField, { type CaptchaProps } from "@/components/auth/captcha-field";

export default function RegisterForm({
  captcha,
  labels,
  termsRequired,
  referralCode,
}: {
  /** Null when captcha is off or not configured. */
  captcha: CaptchaProps | null;
  referralCode?: string;
  labels: Record<
    | "title"
    | "sub"
    | "username"
    | "email"
    | "password"
    | "confirm"
    | "terms"
    | "submit"
    | "hasaccount"
    | "signin"
    | "referred"
    | "checkInbox"
    | "sentTo",
    string
  >;
  termsRequired: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(registerAction, {});

  // Sign-up finished but the account is not usable until the link is clicked,
  // so the form is replaced rather than left looking unsubmitted.
  if (state.pendingVerification) {
    return (
      <>
        <h1 className="text-2xl font-bold tracking-tight">{labels.checkInbox}</h1>
        <div className="alert alert-success mt-6" role="status">
          <Icon name="mail" size={16} />
          <span>{labels.sentTo.replace("{email}", state.pendingVerification)}</span>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{labels.title}</h1>
      <p className="muted mt-2 text-sm">{labels.sub}</p>

      {state.error && (
        <div className="alert alert-danger mt-6" role="alert">
          <Icon name="alert" size={16} />
          <span>{state.error}</span>
        </div>
      )}

      {referralCode && (
        <div className="alert alert-info mt-6" role="status">
          <Icon name="gift" size={16} />
          <span>{labels.referred.replace("{code}", referralCode)}</span>
        </div>
      )}

      <form action={action} className="mt-6 space-y-4" noValidate>
        {referralCode && <input type="hidden" name="ref" value={referralCode} />}
        <Field
          name="username"
          label={labels.username}
          error={state.fieldErrors?.username}
          hint="3–24 characters, letters, numbers and underscore"
          required
        >
          <TextInput
            name="username"
            type="text"
            autoComplete="username"
            autoFocus
            defaultValue={state.values?.username}
            error={state.fieldErrors?.username}
            hint="3–24 characters, letters, numbers and underscore"
            placeholder="yourname"
          />
        </Field>

        <Field name="email" label={labels.email} error={state.fieldErrors?.email} required>
          <TextInput
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state.values?.email}
            error={state.fieldErrors?.email}
            placeholder="you@example.com"
          />
        </Field>

        <Field
          name="password"
          label={labels.password}
          error={state.fieldErrors?.password}
          hint="At least 8 characters"
          required
        >
          <TextInput
            name="password"
            type="password"
            autoComplete="new-password"
            error={state.fieldErrors?.password}
            hint="At least 8 characters"
            placeholder="••••••••"
          />
        </Field>

        <Field name="confirm" label={labels.confirm} error={state.fieldErrors?.confirm} required>
          <TextInput
            name="confirm"
            type="password"
            autoComplete="new-password"
            error={state.fieldErrors?.confirm}
            placeholder="••••••••"
          />
        </Field>

        {termsRequired && (
          <div>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input type="checkbox" name="terms" className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
              <span className="muted">
                {labels.terms}{" "}
                <Link href="/p/terms" className="text-[var(--primary)] hover:underline">
                  &rarr;
                </Link>
              </span>
            </label>
            {state.fieldErrors?.terms && (
              <p className="form-error" role="alert">
                <Icon name="alert" size={14} />
                <span>{state.fieldErrors.terms}</span>
              </p>
            )}
          </div>
        )}

        {captcha && <CaptchaField config={captcha} />}

        <SubmitButton className="btn btn-primary w-full">
          {labels.submit}
          <Icon name="arrowRight" size={16} />
        </SubmitButton>
      </form>

      <p className="muted mt-6 text-center text-sm">
        {labels.hasaccount}{" "}
        <Link href="/login" className="font-medium text-[var(--primary)] hover:underline">
          {labels.signin}
        </Link>
      </p>
    </>
  );
}
