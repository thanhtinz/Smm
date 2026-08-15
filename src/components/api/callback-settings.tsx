"use client";

import { useActionState } from "react";
import { saveCallbackUrlAction, type ActionResult } from "@/app/actions/callback-url";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import { Icon } from "@/components/icons";

export type Delivery = {
  id: string;
  publicId: number;
  status: string;
  attempts: number;
  lastCode: number;
  lastError: string;
  at: string;
};

/**
 * The callback address, and what happened the last few times it was used.
 *
 * The log is the point of this screen. A webhook that quietly fails is the
 * classic way for an integration to be broken for a week, and a reseller who
 * can read "HTTP 502, 4 attempts" fixes it themselves instead of opening a
 * ticket the panel cannot answer either.
 */
export default function CallbackSettings({
  url,
  deliveries,
  labels,
}: {
  url: string;
  deliveries: Delivery[];
  labels: Record<string, string>;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(saveCallbackUrlAction, {});

  return (
    <div className="card card-pad space-y-4">
      <div>
        <h3 className="font-semibold">{labels.title}</h3>
        <p className="muted mt-1 text-sm">{labels.intro}</p>
      </div>

      {state.ok && (
        <div className="alert alert-success" role="status">
          <Icon name="check" size={16} />
          <span>{labels.saved}</span>
        </div>
      )}

      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <Field name="callbackUrl" label={labels.url} error={state.fieldErrors?.callbackUrl}>
            <TextInput
              name="callbackUrl"
              type="url"
              defaultValue={url}
              placeholder="https://your-panel.com/webhooks/nova"
              error={state.fieldErrors?.callbackUrl}
            />
          </Field>
        </div>
        <SubmitButton className="btn btn-primary">
          <Icon name="check" size={16} />
          {labels.save}
        </SubmitButton>
      </form>

      {deliveries.length > 0 && (
        <div>
          <h4 className="muted text-xs font-semibold tracking-[0.14em] uppercase">{labels.recent}</h4>
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {deliveries.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <span className={`badge badge-${d.status === "delivered" ? "success" : d.status === "failed" ? "danger" : "info"}`}>
                  {labels[`state.${d.status}`] ?? d.status}
                </span>
                <span className="font-mono text-xs">#{d.publicId}</span>
                {/* The error already names the status code where there was
                    one, so showing both reads as "HTTP 500 · HTTP 500". */}
                <span className="muted min-w-0 flex-1 truncate text-xs">
                  {d.lastError || (d.lastCode > 0 ? `HTTP ${d.lastCode}` : "")}
                </span>
                <span className="muted text-xs tabular-nums">
                  {d.attempts} {labels.attempts}
                </span>
                <span className="muted text-xs">{d.at}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
