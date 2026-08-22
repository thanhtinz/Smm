"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type FormState } from "@/app/actions/auth";
import { Field, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/icons";
import SubmitButton from "@/components/ui/submit-button";
import CaptchaField, { type CaptchaProps } from "@/components/auth/captcha-field";

export default function LoginForm({
  captcha,
  notice,
  next,
  social,
  error,
  labels,
}: {
  /** Null when captcha is off or not configured. */
  captcha: CaptchaProps | null;
  /** One-off message from a redirect, e.g. after a password reset. */
  notice?: string;
  /** Where to go once they are in. Already checked by the page. */
  next?: string;
  /** The other ways in, rendered on the server because they read settings. */
  social?: React.ReactNode;
  /** A refusal that happened before the form, e.g. a failed trip to Google. */
  error?: string;
  labels: Record<"title" | "sub" | "identifier" | "password" | "remember" | "forgot" | "submit" | "noaccount" | "signup" | "unverified" | "resend", string>;
}) {
  const [state, action] = useActionState<FormState, FormData>(loginAction, {});

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{labels.title}</h1>
      <p className="muted mt-2 text-sm">{labels.sub}</p>

      {(state.error || error) && (
        <div className="alert alert-danger mt-6" role="alert">
          <Icon name="alert" size={16} />
          <span>{state.error || error}</span>
        </div>
      )}

      {notice && (
        <div className="alert alert-success mt-6" role="status">
          <Icon name="checkCircle" size={16} />
          <span>{notice}</span>
        </div>
      )}

      {state.unverified && (
        <div className="alert alert-warning mt-6" role="alert">
          <Icon name="mail" size={16} />
          <span>
            {labels.unverified}{" "}
            <Link href={`/resend-verification?email=${encodeURIComponent(state.unverified)}`} className="font-medium underline">
              {labels.resend}
            </Link>
          </span>
        </div>
      )}

      <form action={action} className="mt-6 space-y-4" noValidate>
        {next && <input type="hidden" name="next" value={next} />}
        <Field name="identifier" label={labels.identifier} error={state.fieldErrors?.identifier} required>
          <TextInput
            name="identifier"
            type="text"
            autoComplete="username"
            autoFocus
            defaultValue={state.values?.identifier}
            error={state.fieldErrors?.identifier}
            placeholder="demo"
          />
        </Field>

        <Field name="password" label={labels.password} error={state.fieldErrors?.password} required>
          <TextInput
            name="password"
            type="password"
            autoComplete="current-password"
            error={state.fieldErrors?.password}
            placeholder="••••••••"
          />
        </Field>

        <div className="flex items-center justify-between pt-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" name="remember" defaultChecked className="h-4 w-4 accent-[var(--primary)]" />
            <span className="muted">{labels.remember}</span>
          </label>
          <Link href="/forgot-password" className="text-sm font-medium text-[var(--primary)] hover:underline">
            {labels.forgot}
          </Link>
        </div>

        {captcha && <CaptchaField config={captcha} />}

        <SubmitButton className="btn btn-primary w-full">
          {labels.submit}
          <Icon name="arrowRight" size={16} />
        </SubmitButton>
      </form>

      {social}

      <p className="muted mt-6 text-center text-sm">
        {labels.noaccount}{" "}
        <Link href="/register" className="font-medium text-[var(--primary)] hover:underline">
          {labels.signup}
        </Link>
      </p>
    </>
  );
}
