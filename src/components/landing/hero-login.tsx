"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type FormState } from "@/app/actions/auth";
import { Icon } from "@/components/icons";
import SubmitButton from "@/components/ui/submit-button";
import CaptchaField, { type CaptchaProps } from "@/components/auth/captcha-field";

export type HeroLoginLabels = Record<
  "username" | "password" | "remember" | "forgot" | "submit" | "noaccount" | "signup",
  string
>;

/**
 * Sign in, on the home page.
 *
 * The panels this market compares us against all put the box here, and they
 * are right to: most people arriving at a panel's home page already have an
 * account and want the dashboard, not the pitch. It posts to the same action
 * as /login, so verification, two-factor and captcha all behave identically —
 * this is a second doorway, not a second implementation.
 */
export default function HeroLogin({
  captcha,
  labels,
}: {
  captcha: CaptchaProps | null;
  labels: HeroLoginLabels;
}) {
  const [state, action] = useActionState<FormState, FormData>(loginAction, {});

  return (
    <form action={action} className="space-y-3" noValidate>
      {state.error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{state.error}</span>
        </div>
      )}

      <div className="relative">
        <span className="muted pointer-events-none absolute top-1/2 start-3.5 -translate-y-1/2">
          <Icon name="user" size={16} />
        </span>
        <label htmlFor="hero-identifier" className="sr-only">
          {labels.username}
        </label>
        <input
          id="hero-identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          placeholder={labels.username}
          defaultValue={state.values?.identifier}
          className="field ps-11"
        />
      </div>

      <div className="relative">
        <span className="muted pointer-events-none absolute top-1/2 start-3.5 -translate-y-1/2">
          <Icon name="lock" size={16} />
        </span>
        <label htmlFor="hero-password" className="sr-only">
          {labels.password}
        </label>
        <input
          id="hero-password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder={labels.password}
          className="field ps-11"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" name="remember" defaultChecked className="h-4 w-4 accent-[var(--primary)]" />
          <span className="muted">{labels.remember}</span>
        </label>
        <Link href="/forgot-password" className="text-sm font-medium text-[var(--primary)] hover:underline">
          {labels.forgot}
        </Link>
      </div>

      {captcha && <CaptchaField config={captcha} />}

      <SubmitButton className="btn btn-primary btn-lg w-full">
        {labels.submit}
        <Icon name="arrowRight" size={16} />
      </SubmitButton>

      <p className="muted text-center text-sm">
        {labels.noaccount}{" "}
        <Link href="/register" className="font-medium text-[var(--primary)] hover:underline">
          {labels.signup}
        </Link>
      </p>
    </form>
  );
}
