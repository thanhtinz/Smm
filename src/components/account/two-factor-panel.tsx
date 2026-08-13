"use client";

import { useActionState, useState, useTransition } from "react";
import {
  beginSetupAction,
  confirmSetupAction,
  disableAction,
  regenerateRecoveryAction,
  type SetupState,
} from "@/app/actions/two-factor";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import { Icon } from "@/components/icons";

export type TwoFactorLabels = Record<
  | "title"
  | "off"
  | "on"
  | "enforced"
  | "start"
  | "scan"
  | "manual"
  | "code"
  | "codeHint"
  | "confirm"
  | "cancel"
  | "saved"
  | "codesTitle"
  | "codesHint"
  | "copy"
  | "copied"
  | "done"
  | "recoveryLeft"
  | "regenerate"
  | "disable"
  | "password"
  | "since",
  string
>;

export default function TwoFactorPanel({
  enabled,
  enabledOn,
  enforced,
  recoveryLeft,
  qrFor,
  labels,
}: {
  enabled: boolean;
  enabledOn: string;
  /** The panel requires it, so it cannot be switched off. */
  enforced: boolean;
  recoveryLeft: number;
  /** Renders a secret's QR on the server — the encoder does not belong in the bundle. */
  qrFor: (secret: string) => Promise<{ svg: string; uri: string }>;
  labels: TwoFactorLabels;
}) {
  const [setup, setSetup] = useState<{ secret: string; svg: string; uri: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [pending, start] = useTransition();

  const [confirmState, confirm] = useActionState<SetupState, FormData>(async (prev, form) => {
    const result = await confirmSetupAction(prev, form);
    if (result.codes) {
      setCodes(result.codes);
      setSetup(null);
    }
    return result;
  }, {});

  const [manageState, manage] = useActionState<SetupState, FormData>(async (prev, form) => {
    const result =
      form.get("intent") === "disable"
        ? await disableAction(prev, form)
        : await regenerateRecoveryAction(prev, form);
    if (result.codes) setCodes(result.codes);
    return result;
  }, {});

  const begin = () =>
    start(async () => {
      const { secret } = await beginSetupAction();
      setSetup({ secret, ...(await qrFor(secret)) });
    });

  // Shown once, right after they are minted — nothing can show them again.
  if (codes) {
    return (
      <section className="card card-pad space-y-4">
        <h3 className="font-semibold">{labels.codesTitle}</h3>
        <p className="muted text-sm">{labels.codesHint}</p>
        <ul className="surface-2 grid grid-cols-2 gap-2 rounded-xl p-4 font-mono text-sm">
          {codes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <div className="flex gap-2">
          <CopyButton value={codes.join("\n")} labels={labels} />
          <button type="button" onClick={() => setCodes(null)} className="btn btn-primary btn-sm">
            <Icon name="check" size={15} />
            {labels.done}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card card-pad space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">{labels.title}</h3>
        <span className={`badge ${enabled ? "badge-success" : "badge-muted"}`}>
          <Icon name={enabled ? "shield" : "alert"} size={13} />
          {enabled ? labels.on : labels.off}
        </span>
      </div>

      {enabled && <p className="muted text-sm">{labels.since.replace("{date}", enabledOn)}</p>}
      {enforced && <p className="muted text-sm">{labels.enforced}</p>}

      {(confirmState.error || manageState.error) && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{confirmState.error ?? manageState.error}</span>
        </div>
      )}

      {!enabled && !setup && (
        <button type="button" onClick={begin} disabled={pending} className="btn btn-primary btn-sm">
          <Icon name="shield" size={15} />
          {labels.start}
        </button>
      )}

      {setup && (
        <div className="space-y-4">
          <p className="muted text-sm">{labels.scan}</p>
          {/* Server-rendered SVG: the QR is a picture of the secret, so it is
              built where the secret already is. */}
          <div
            className="inline-block rounded-xl bg-white p-3"
            dangerouslySetInnerHTML={{ __html: setup.svg }}
          />
          <div>
            <span className="label">{labels.manual}</span>
            <code className="surface-2 block rounded-lg p-3 font-mono text-sm break-all">{setup.secret}</code>
          </div>

          <form action={confirm} className="space-y-3" noValidate>
            <Field name="code" label={labels.code} hint={labels.codeHint} error={confirmState.fieldErrors?.code} required>
              <TextInput
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className="text-center font-mono text-lg tracking-[0.4em]"
                error={confirmState.fieldErrors?.code}
                hint={labels.codeHint}
              />
            </Field>
            <div className="flex gap-2">
              <SubmitButton className="btn btn-primary btn-sm">
                <Icon name="check" size={15} />
                {labels.confirm}
              </SubmitButton>
              <button type="button" onClick={() => setSetup(null)} className="btn btn-ghost btn-sm">
                {labels.cancel}
              </button>
            </div>
          </form>
        </div>
      )}

      {enabled && (
        <>
          <p className="muted text-sm">{labels.recoveryLeft.replace("{count}", String(recoveryLeft))}</p>
          <form action={manage} className="space-y-3" noValidate>
            <Field name="password" label={labels.password} error={manageState.fieldErrors?.password} required>
              <TextInput
                name="password"
                type="password"
                autoComplete="current-password"
                error={manageState.fieldErrors?.password}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <SubmitButton name="intent" value="regenerate" className="btn btn-ghost btn-sm">
                <Icon name="refresh" size={15} />
                {labels.regenerate}
              </SubmitButton>
              {!enforced && (
                <SubmitButton name="intent" value="disable" className="btn btn-danger btn-sm">
                  <Icon name="trash" size={15} />
                  {labels.disable}
                </SubmitButton>
              )}
            </div>
          </form>
        </>
      )}
    </section>
  );
}

function CopyButton({ value, labels }: { value: string; labels: TwoFactorLabels }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
      }}
      className="btn btn-ghost btn-sm"
    >
      <Icon name={copied ? "check" : "copy"} size={15} />
      {copied ? labels.copied : labels.copy}
    </button>
  );
}
