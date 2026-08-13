"use client";

import { useActionState, useState, useTransition } from "react";
import { deletePlatformAction, savePlatformAction, type ActionResult } from "@/app/actions/admin/catalogue";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import EntityDrawer from "@/components/admin/entity-drawer";
import IconPicker from "@/components/admin/icon-picker";
import { Icon, type IconName } from "@/components/icons";

export type PlatformRow = {
  id: string;
  slug: string;
  name: string;
  icon: string;
  color: string;
  visible: boolean;
  position: number;
  categoryCount: number;
};

export default function PlatformManager({ rows, labels }: { rows: PlatformRow[]; labels: Record<string, string> }) {
  const [editing, setEditing] = useState<PlatformRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const close = () => {
    setEditing(null);
    setCreating(false);
  };

  const remove = (row: PlatformRow) => {
    if (!confirm(labels.confirmDelete)) return;
    setError("");
    start(async () => {
      const result = await deletePlatformAction(row.id);
      if (result.error) setError(result.error);
    });
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
                  <th className="w-16">{labels.icon}</th>
                  <th>{labels.name}</th>
                  <th className="w-40">{labels.slug}</th>
                  <th className="w-28 text-right">{labels.categories}</th>
                  <th className="w-28">{labels.status}</th>
                  <th className="w-24 text-right">{labels.actions}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-lg"
                        style={{ background: `${row.color}22`, color: row.color }}
                      >
                        <Icon name={row.icon as IconName} size={18} />
                      </span>
                    </td>
                    <td className="font-medium">{row.name}</td>
                    <td className="muted font-mono text-xs">{row.slug}</td>
                    <td className="text-right tabular-nums">{row.categoryCount}</td>
                    <td>
                      <span className={`badge ${row.visible ? "badge-success" : "badge-muted"}`}>
                        <Icon name={row.visible ? "eye" : "close"} size={11} />
                        {row.visible ? labels.visible : labels.hidden}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditing(row)}
                          className="btn btn-ghost btn-sm"
                          aria-label={`${labels.edit} ${row.name}`}
                        >
                          <Icon name="edit" size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(row)}
                          disabled={pending}
                          className="btn btn-danger btn-sm"
                          aria-label={`${labels.delete} ${row.name}`}
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
        title={editing ? `${labels.edit} — ${editing.name}` : labels.new}
        onClose={close}
      >
        <PlatformForm key={editing?.id ?? "new"} row={editing} labels={labels} onDone={close} />
      </EntityDrawer>
    </>
  );
}

function PlatformForm({
  row,
  labels,
  onDone,
}: {
  row: PlatformRow | null;
  labels: Record<string, string>;
  onDone: () => void;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(async (prev, form) => {
    const result = await savePlatformAction(prev, form);
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

      <Field name="name" label={labels.name} error={state.fieldErrors?.name} required>
        <TextInput name="name" defaultValue={row?.name} error={state.fieldErrors?.name} placeholder="Instagram" />
      </Field>

      <Field
        name="slug"
        label={labels.slug}
        error={state.fieldErrors?.slug}
        hint={labels.slugHint}
      >
        <TextInput name="slug" defaultValue={row?.slug} error={state.fieldErrors?.slug} hint={labels.slugHint} placeholder="instagram" />
      </Field>

      <IconPicker name="icon" value={row?.icon ?? "globe"} color={row?.color} label={labels.icon} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="color" label={labels.color}>
          <input
            id="color"
            name="color"
            type="color"
            defaultValue={row?.color ?? "#6366f1"}
            className="field h-11 cursor-pointer p-1"
          />
        </Field>
        <Field name="position" label={labels.position}>
          <TextInput name="position" type="number" defaultValue={String(row?.position ?? 0)} />
        </Field>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input type="checkbox" name="visible" defaultChecked={row?.visible ?? true} className="h-4 w-4 accent-[var(--primary)]" />
        {labels.visible}
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
