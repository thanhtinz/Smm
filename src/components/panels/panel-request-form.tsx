"use client";

import { useActionState, useState, useTransition } from "react";
import { requestPanelAction, refreshDelegationAction, type PanelRequestState } from "@/app/actions/panel-requests";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import CopyField from "@/components/ui/copy-field";
import { Icon } from "@/components/icons";

export type OpenRequest = {
  id: string;
  publicId: number;
  name: string;
  host: string;
  status: string;
  nameServers: string[];
  note: string;
};

export type PastRequest = {
  id: string;
  publicId: number;
  host: string;
  status: string;
  note: string;
  at: string;
};

type Labels = {
  name: string;
  nameHint: string;
  slug: string;
  slugHint: string;
  host: string;
  hostHint: string;
  submit: string;
  waiting: string;
  delegated: string;
  nameServers: string;
  nameServersHint: string;
  recheck: string;
  history: string;
  copy: string;
  copied: string;
  status: Record<string, string>;
};

/**
 * The request, and then the waiting.
 *
 * A reseller with a request open never sees the form again — there is only
 * one thing to do at a time, and showing an empty form beside a pending
 * request invites them to file a second one.
 */
export default function PanelRequestForm({
  open,
  history,
  rent,
  labels,
}: {
  open: OpenRequest | false | undefined;
  history: PastRequest[];
  /** What it costs, when the operator charges for it. */
  rent: string;
  labels: Labels;
}) {
  const [state, action] = useActionState<PanelRequestState, FormData>(requestPanelAction, {});

  return (
    <>
      {open ? <Waiting request={open} labels={labels} /> : <Ask state={state} action={action} rent={rent} labels={labels} />}

      {history.length > 0 && (
        <section className="card card-pad">
          <h3 className="font-semibold">{labels.history}</h3>
          <ul className="mt-3 space-y-2">
            {history.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span>
                  <span className="muted mr-2 font-mono text-xs">#{r.publicId}</span>
                  {r.host}
                  {r.note && <span className="muted ml-2 text-xs">{r.note}</span>}
                </span>
                <span className="muted flex items-center gap-2 text-xs">
                  {r.at}
                  <span className={r.status === "approved" ? "badge badge-success" : "badge badge-muted"}>
                    {labels.status[r.status] ?? r.status}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Ask({
  state,
  action,
  rent,
  labels,
}: {
  state: PanelRequestState;
  action: (form: FormData) => void;
  rent: string;
  labels: Labels;
}) {
  return (
    <form action={action} className="card card-pad space-y-4">
      {state.error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{state.error}</span>
        </div>
      )}

      <Field name="name" label={labels.name} hint={labels.nameHint} required>
        <TextInput name="name" autoComplete="off" hint={labels.nameHint} required />
      </Field>

      <Field name="slug" label={labels.slug} hint={labels.slugHint}>
        <TextInput name="slug" autoComplete="off" hint={labels.slugHint} />
      </Field>

      <Field name="host" label={labels.host} hint={labels.hostHint} required>
        <TextInput name="host" autoComplete="off" placeholder="shopcuaban.com" hint={labels.hostHint} required />
      </Field>

      {rent && <p className="muted text-sm">{rent}</p>}

      <SubmitButton className="btn btn-primary w-full">{labels.submit}</SubmitButton>
    </form>
  );
}

/**
 * What to do next, and whether it has taken effect.
 *
 * The nameservers are the only thing on screen the reseller has to act on, so
 * they are the only thing that looks like a control.
 */
function Waiting({ request, labels }: { request: OpenRequest; labels: Labels }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const delegated = request.status === "delegated";

  const recheck = () => {
    setError("");
    start(async () => {
      const result = await refreshDelegationAction(request.id);
      if (result.error) setError(result.error);
    });
  };

  return (
    <section className="card card-pad space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">
          {request.name}
          <span className="muted ml-2 font-mono text-xs">#{request.publicId}</span>
        </h3>
        <span className={delegated ? "badge badge-success" : "badge badge-info"}>
          <Icon name={delegated ? "checkCircle" : "clock"} size={11} />
          {labels.status[request.status] ?? request.status}
        </span>
      </div>

      <p className="text-sm">{delegated ? labels.delegated : labels.waiting}</p>

      {request.nameServers.length > 0 && !delegated && (
        <div className="space-y-2">
          <p className="muted text-xs">{labels.nameServersHint}</p>
          {request.nameServers.map((ns, i) => (
            <CopyField
              key={ns}
              label={`${labels.nameServers} ${i + 1}`}
              value={ns}
              copyLabel={labels.copy}
              copiedLabel={labels.copied}
              mono
            />
          ))}
        </div>
      )}

      {request.note && <p className="alert alert-warning text-xs">{request.note}</p>}

      {error && (
        <p className="form-error" role="alert">
          <span>{error}</span>
        </p>
      )}

      {!delegated && (
        <button type="button" onClick={recheck} disabled={pending} className="btn btn-ghost btn-sm">
          <Icon name="refresh" size={14} />
          {labels.recheck}
        </button>
      )}
    </section>
  );
}
