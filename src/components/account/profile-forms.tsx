"use client";

import { useActionState } from "react";
import { changePasswordAction, updateProfileAction, type ProfileState } from "@/app/actions/profile";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import { Icon } from "@/components/icons";

export default function ProfileForms({
  username,
  email,
  fullName,
  joined,
  labels,
}: {
  username: string;
  email: string;
  fullName: string;
  joined: string;
  labels: Record<
    | "account"
    | "username"
    | "email"
    | "fullName"
    | "joined"
    | "save"
    | "saved"
    | "passwordTitle"
    | "passwordHint"
    | "current"
    | "password"
    | "confirm"
    | "changed",
    string
  >;
}) {
  const [profile, saveProfile] = useActionState<ProfileState, FormData>(updateProfileAction, {});
  const [password, changePassword] = useActionState<ProfileState, FormData>(changePasswordAction, {});

  return (
    <>
      <section className="card card-pad space-y-4">
        <h3 className="font-semibold">{labels.account}</h3>

        {profile.ok && (
          <div className="alert alert-success" role="status">
            <Icon name="checkCircle" size={16} />
            <span>{labels.saved}</span>
          </div>
        )}

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <Row label={labels.username} value={username} />
          <Row label={labels.email} value={email} />
          <Row label={labels.joined} value={joined} />
        </dl>

        <form action={saveProfile} className="space-y-3" noValidate>
          <Field name="fullName" label={labels.fullName} error={profile.fieldErrors?.fullName}>
            <TextInput name="fullName" defaultValue={fullName} error={profile.fieldErrors?.fullName} />
          </Field>
          <SubmitButton className="btn btn-primary btn-sm">
            <Icon name="check" size={15} />
            {labels.save}
          </SubmitButton>
        </form>
      </section>

      <section className="card card-pad space-y-4">
        <h3 className="font-semibold">{labels.passwordTitle}</h3>
        <p className="muted text-sm">{labels.passwordHint}</p>

        {password.ok && (
          <div className="alert alert-success" role="status">
            <Icon name="checkCircle" size={16} />
            <span>{labels.changed}</span>
          </div>
        )}

        <form action={changePassword} className="space-y-3" noValidate>
          <Field name="current" label={labels.current} error={password.fieldErrors?.current} required>
            <TextInput
              name="current"
              type="password"
              autoComplete="current-password"
              error={password.fieldErrors?.current}
            />
          </Field>
          <Field name="password" label={labels.password} error={password.fieldErrors?.password} required>
            <TextInput
              name="password"
              type="password"
              autoComplete="new-password"
              error={password.fieldErrors?.password}
            />
          </Field>
          <Field name="confirm" label={labels.confirm} error={password.fieldErrors?.confirm} required>
            <TextInput
              name="confirm"
              type="password"
              autoComplete="new-password"
              error={password.fieldErrors?.confirm}
            />
          </Field>
          <SubmitButton className="btn btn-primary btn-sm">
            <Icon name="check" size={15} />
            {labels.save}
          </SubmitButton>
        </form>
      </section>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="muted text-xs tracking-wide uppercase">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
