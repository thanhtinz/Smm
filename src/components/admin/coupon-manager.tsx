"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteCouponAction, saveCouponAction, type ActionResult } from "@/app/actions/admin/config";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import EntityDrawer from "@/components/admin/entity-drawer";
import { Icon } from "@/components/icons";

export type CouponRow = {
  id: string;
  code: string;
  type: string;
  value: number;
  minAmount: number;
  maxUses: number;
  maxPerUser: number;
  firstDepositOnly: boolean;
  enabled: boolean;
  expiresAt: string;
  used: number;
};

export default function CouponManager({ rows, labels }: { rows: CouponRow[]; labels: Record<string, string> }) {
  const [editing, setEditing] = useState<CouponRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const close = () => {
    setEditing(null);
    setCreating(false);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{labels.title}</h2>
        <button type="button" onClick={() => setCreating(true)} className="btn btn-primary btn-sm">
          <Icon name="plus" size={15} />
          {labels.new}
        </button>
      </div>

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
                  <th className="w-36">{labels.code}</th>
                  <th className="w-32">{labels.bonus}</th>
                  <th className="w-32 text-right">{labels.minAmount}</th>
                  <th className="w-28 text-right">{labels.used}</th>
                  <th className="w-32">{labels.expires}</th>
                  <th className="w-28">{labels.status}</th>
                  <th className="w-24 text-right">{labels.actions}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-mono font-semibold">{row.code}</td>
                    <td>
                      <span className="badge badge-success">
                        <Icon name="gift" size={11} />
                        {row.type === "percent" ? `${row.value}%` : row.value.toLocaleString()}
                      </span>
                      {row.firstDepositOnly && <span className="muted mt-0.5 block text-xs">{labels.firstOnly}</span>}
                    </td>
                    <td className="muted text-right tabular-nums">{row.minAmount ? row.minAmount.toLocaleString() : "—"}</td>
                    <td className="text-right tabular-nums">
                      {row.used}
                      {row.maxUses > 0 ? ` / ${row.maxUses}` : ""}
                    </td>
                    <td className="muted text-xs">{row.expiresAt || "—"}</td>
                    <td>
                      <span className={`badge ${row.enabled ? "badge-success" : "badge-muted"}`}>
                        <Icon name={row.enabled ? "check" : "close"} size={11} />
                        {row.enabled ? labels.enabled : labels.disabled}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => setEditing(row)} className="btn btn-ghost btn-sm">
                          <Icon name="edit" size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            if (!confirm(labels.confirmDelete)) return;
                            setError("");
                            start(async () => {
                              const result = await deleteCouponAction(row.id);
                              if (result.error) setError(result.error);
                            });
                          }}
                          className="btn btn-danger btn-sm"
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EntityDrawer
        open={creating || editing !== null}
        title={editing ? `${labels.edit} — ${editing.code}` : labels.new}
        onClose={close}
      >
        <CouponForm key={editing?.id ?? "new"} row={editing} labels={labels} onDone={close} />
      </EntityDrawer>
    </>
  );
}

function CouponForm({
  row,
  labels,
  onDone,
}: {
  row: CouponRow | null;
  labels: Record<string, string>;
  onDone: () => void;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(async (prev, form) => {
    const result = await saveCouponAction(prev, form);
    if (result.ok) onDone();
    return result;
  }, {});

  return (
    <form action={action} className="space-y-4" noValidate>
      {row && <input type="hidden" name="id" value={row.id} />}

      {state.error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{state.error}</span>
        </div>
      )}

      <Field name="code" label={labels.code} error={state.fieldErrors?.code} required>
        <TextInput name="code" defaultValue={row?.code} error={state.fieldErrors?.code} placeholder="WELCOME10" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="type" label={labels.type}>
          <select id="type" name="type" className="field" defaultValue={row?.type ?? "percent"}>
            <option value="percent">{labels.percent}</option>
            <option value="fixed">{labels.fixed}</option>
          </select>
        </Field>
        <Field name="value" label={labels.value} error={state.fieldErrors?.value} required>
          <TextInput name="value" type="number" step="any" defaultValue={String(row?.value ?? "")} error={state.fieldErrors?.value} />
        </Field>
        <Field name="minAmount" label={labels.minAmount}>
          <TextInput name="minAmount" type="number" step="any" defaultValue={String(row?.minAmount ?? 0)} />
        </Field>
        <Field name="expiresAt" label={labels.expires} error={state.fieldErrors?.expiresAt}>
          <TextInput name="expiresAt" type="date" defaultValue={row?.expiresAt} error={state.fieldErrors?.expiresAt} />
        </Field>
        <Field name="maxUses" label={labels.maxUses} hint={labels.zeroUnlimited}>
          <TextInput name="maxUses" type="number" defaultValue={String(row?.maxUses ?? 0)} hint={labels.zeroUnlimited} />
        </Field>
        <Field name="maxPerUser" label={labels.maxPerUser} hint={labels.zeroUnlimited}>
          <TextInput name="maxPerUser" type="number" defaultValue={String(row?.maxPerUser ?? 1)} hint={labels.zeroUnlimited} />
        </Field>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          name="firstDepositOnly"
          defaultChecked={row?.firstDepositOnly ?? false}
          className="h-4 w-4 accent-[var(--primary)]"
        />
        {labels.firstOnly}
      </label>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={row?.enabled ?? true} className="h-4 w-4 accent-[var(--primary)]" />
        {labels.enabled}
      </label>

      <div className="flex gap-2 pt-2">
        <SubmitButton className="btn btn-primary flex-1">
          <Icon name="check" size={16} />
          {labels.save}
        </SubmitButton>
        <button type="button" onClick={onDone} className="btn btn-ghost">
          {labels.cancel}
        </button>
      </div>
    </form>
  );
}
