"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  addPanelDomainAction,
  createChildPanelAction,
  deletePanelDomainAction,
  resetChildAdminAction,
  setPanelStatusAction,
  verifyPanelDomainAction,
  type ActionResult,
} from "@/app/actions/admin/panels";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import EntityDrawer from "@/components/admin/entity-drawer";
import CopyField from "@/components/ui/copy-field";
import { Icon } from "@/components/icons";

export type DomainRow = { id: string; host: string; verified: boolean; isPrimary: boolean; verifyToken: string };

export type PanelRow = {
  id: string;
  slug: string;
  name: string;
  depth: number;
  status: string;
  statusNote: string;
  ownerName: string;
  users: number;
  orders: number;
  services: number;
  domains: DomainRow[];
};

export type OwnerOption = { id: string; label: string };

export default function PanelManager({
  rows,
  owners,
  canCreate,
  limitNote,
  labels,
}: {
  rows: PanelRow[];
  owners: OwnerOption[];
  canCreate: boolean;
  limitNote: string;
  labels: Record<string, string>;
}) {
  const [creating, setCreating] = useState(false);
  const [domains, setDomains] = useState<PanelRow | null>(null);
  const [reset, setReset] = useState<PanelRow | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<ActionResult>) => {
    setError("");
    start(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{labels.title}</h2>
        {canCreate && (
          <button type="button" onClick={() => setCreating(true)} className="btn btn-primary btn-sm">
            <Icon name="plus" size={15} />
            {labels.new}
          </button>
        )}
      </div>

      {limitNote && (
        <div className="alert alert-info" role="status">
          <Icon name="info" size={16} />
          <span>{limitNote}</span>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <p className="muted px-5 py-14 text-center text-sm">{labels.empty}</p>
        ) : (
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>{labels.panel}</th>
                  <th>{labels.domain}</th>
                  <th className="w-32">{labels.owner}</th>
                  <th className="w-20 text-right">{labels.users}</th>
                  <th className="w-20 text-right">{labels.orders}</th>
                  <th className="w-24">{labels.status}</th>
                  <th className="w-px" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const primary = row.domains[0];
                  return (
                    <tr key={row.id}>
                      <td>
                        <span className="font-medium">{row.name}</span>
                        <span className="muted block font-mono text-xs">
                          {row.slug} · {labels.level} {row.depth}
                        </span>
                      </td>
                      <td>
                        <span className="font-mono text-xs">{primary?.host ?? "—"}</span>
                        {primary && !primary.verified && (
                          <span className="badge badge-warning ml-2">{labels.unverified}</span>
                        )}
                        {row.domains.length > 1 && (
                          <span className="muted ml-2 text-xs">+{row.domains.length - 1}</span>
                        )}
                      </td>
                      <td className="muted text-xs">{row.ownerName}</td>
                      <td className="text-right tabular-nums">{row.users}</td>
                      <td className="text-right tabular-nums">{row.orders}</td>
                      <td>
                        <span className={`badge ${row.status === "active" ? "badge-success" : "badge-warning"}`}>
                          {labels[`status.${row.status}`] ?? row.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDomains(row)}
                            className="btn btn-ghost btn-sm"
                            title={labels.domains}
                          >
                            <Icon name="globe" size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setReset(row)}
                            className="btn btn-ghost btn-sm"
                            title={labels.resetAdmin}
                          >
                            <Icon name="key" size={15} />
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              run(() => setPanelStatusAction(row.id, row.status === "active" ? "suspended" : "active"))
                            }
                            className="btn btn-ghost btn-sm"
                            title={row.status === "active" ? labels.suspend : labels.resume}
                          >
                            <Icon name={row.status === "active" ? "pause" : "play"} size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && <CreateDrawer owners={owners} labels={labels} onClose={() => setCreating(false)} />}
      {domains && <DomainDrawer panel={domains} labels={labels} onClose={() => setDomains(null)} />}
      {reset && <ResetDrawer panel={reset} labels={labels} onClose={() => setReset(null)} />}
    </>
  );
}

function CreateDrawer({
  owners,
  labels,
  onClose,
}: {
  owners: OwnerOption[];
  labels: Record<string, string>;
  onClose: () => void;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(createChildPanelAction, {});
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <EntityDrawer open title={labels.new} onClose={onClose}>
      <form action={action} className="space-y-4">
        {state.error && (
          <div className="alert alert-danger" role="alert">
            <Icon name="alert" size={16} />
            <span>{state.error}</span>
          </div>
        )}

        <Field name="name" label={labels.name} error={state.fieldErrors?.name} required>
          <TextInput name="name" error={state.fieldErrors?.name} />
        </Field>
        <Field name="slug" label={labels.slug} error={state.fieldErrors?.slug}>
          <TextInput name="slug" error={state.fieldErrors?.slug} />
        </Field>
        <Field name="host" label={labels.domain} error={state.fieldErrors?.host} required>
          <TextInput name="host" placeholder="panel.example.com" error={state.fieldErrors?.host} />
        </Field>

        <Field name="ownerUserId" label={labels.owner} error={state.fieldErrors?.ownerUserId} required>
          <select id="ownerUserId" name="ownerUserId" className="field" defaultValue="">
            <option value="" disabled>
              —
            </option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="divider" />

        <Field name="adminUsername" label={labels.adminUsername} error={state.fieldErrors?.adminUsername} required>
          <TextInput name="adminUsername" autoComplete="off" error={state.fieldErrors?.adminUsername} />
        </Field>
        <Field name="adminEmail" label={labels.adminEmail} error={state.fieldErrors?.adminEmail} required>
          <TextInput name="adminEmail" type="email" autoComplete="off" error={state.fieldErrors?.adminEmail} />
        </Field>
        <Field name="adminPassword" label={labels.adminPassword} error={state.fieldErrors?.adminPassword} required>
          <TextInput name="adminPassword" type="password" autoComplete="new-password" error={state.fieldErrors?.adminPassword} />
        </Field>

        <SubmitButton className="btn btn-primary w-full">
          <Icon name="check" size={16} />
          {labels.create}
        </SubmitButton>
      </form>
    </EntityDrawer>
  );
}

function DomainDrawer({
  panel,
  labels,
  onClose,
}: {
  panel: PanelRow;
  labels: Record<string, string>;
  onClose: () => void;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(addPanelDomainAction, {});
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<ActionResult>) => {
    setError("");
    start(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
    });
  };

  return (
    <EntityDrawer open title={`${labels.domains} · ${panel.name}`} onClose={onClose}>
      <div className="space-y-4">
        {(error || state.error) && (
          <div className="alert alert-danger" role="alert">
            <Icon name="alert" size={16} />
            <span>{error || state.error}</span>
          </div>
        )}

        <div className="space-y-3">
          {panel.domains.map((d) => (
            <div key={d.id} className="rounded-xl border border-[var(--border)] p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-sm">{d.host}</span>
                <span className={`badge ${d.verified ? "badge-success" : "badge-warning"}`}>
                  {d.verified ? labels.verified : labels.unverified}
                </span>
              </div>

              {!d.verified && (
                <div className="mt-3 space-y-2">
                  <CopyField
                    label={`TXT _nova-panel.${d.host}`}
                    value={`nova-panel-verify=${d.verifyToken}`}
                    copyLabel={labels.copy}
                    copiedLabel={labels.copied}
                    mono
                  />
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => verifyPanelDomainAction(d.id))}
                    className="btn btn-secondary btn-sm"
                  >
                    <Icon name="check" size={15} />
                    {labels.verify}
                  </button>
                </div>
              )}

              {panel.domains.length > 1 && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => deletePanelDomainAction(d.id))}
                  className="btn btn-ghost btn-sm mt-2"
                >
                  <Icon name="trash" size={15} />
                  {labels.remove}
                </button>
              )}
            </div>
          ))}
        </div>

        <form action={action} className="space-y-3">
          <input type="hidden" name="panelId" value={panel.id} />
          <Field name="host" label={labels.addDomain} error={state.fieldErrors?.host}>
            <TextInput name="host" placeholder="panel.example.com" error={state.fieldErrors?.host} />
          </Field>
          <SubmitButton className="btn btn-primary w-full">
            <Icon name="plus" size={16} />
            {labels.addDomain}
          </SubmitButton>
        </form>
      </div>
    </EntityDrawer>
  );
}

function ResetDrawer({
  panel,
  labels,
  onClose,
}: {
  panel: PanelRow;
  labels: Record<string, string>;
  onClose: () => void;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(resetChildAdminAction, {});

  return (
    <EntityDrawer open title={`${labels.resetAdmin} · ${panel.name}`} onClose={onClose}>
      <form action={action} className="space-y-4">
        {state.error && (
          <div className="alert alert-danger" role="alert">
            <Icon name="alert" size={16} />
            <span>{state.error}</span>
          </div>
        )}
        {state.ok && (
          <div className="alert alert-success" role="status">
            <Icon name="checkCircle" size={16} />
            <span>{labels.saved}</span>
          </div>
        )}

        <input type="hidden" name="panelId" value={panel.id} />
        <Field name="password" label={labels.adminPassword} error={state.fieldErrors?.password} required>
          <TextInput name="password" type="password" autoComplete="new-password" error={state.fieldErrors?.password} />
        </Field>

        <SubmitButton className="btn btn-primary w-full">
          <Icon name="check" size={16} />
          {labels.save}
        </SubmitButton>
      </form>
    </EntityDrawer>
  );
}
