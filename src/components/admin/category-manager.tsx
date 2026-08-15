"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteCategoryAction, saveCategoryAction, type ActionResult } from "@/app/actions/admin/catalogue";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import EntityDrawer from "@/components/admin/entity-drawer";
import { Icon } from "@/components/icons";
import PlatformMark from "@/components/platform-mark";

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  platformId: string | null;
  visible: boolean;
  position: number;
  serviceCount: number;
};

export type PlatformOption = { id: string; name: string; icon: string; image: string; color: string };

export default function CategoryManager({
  rows,
  platforms,
  labels,
}: {
  rows: CategoryRow[];
  platforms: PlatformOption[];
  labels: Record<string, string>;
}) {
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [pending, start] = useTransition();

  const close = () => {
    setEditing(null);
    setCreating(false);
  };

  const remove = (row: CategoryRow) => {
    if (!confirm(labels.confirmDelete)) return;
    setError("");
    start(async () => {
      const result = await deleteCategoryAction(row.id);
      if (result.error) setError(result.error);
    });
  };

  const visible = filter ? rows.filter((r) => r.platformId === filter) : rows;
  const platformOf = (id: string | null) => platforms.find((p) => p.id === id);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{labels.title}</h2>
        <div className="flex items-center gap-2">
          <label htmlFor="platform-filter" className="sr-only">
            {labels.filter}
          </label>
          <select
            id="platform-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="field w-auto py-2 text-sm"
          >
            <option value="">{labels.allPlatforms}</option>
            {platforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setCreating(true)}
            disabled={platforms.length === 0}
            className="btn btn-primary btn-sm"
          >
            <Icon name="plus" size={15} />
            {labels.new}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      {platforms.length === 0 && (
        <div className="alert alert-info" role="status">
          <Icon name="info" size={16} />
          <span>{labels.needPlatform}</span>
        </div>
      )}

      <div className="card overflow-hidden">
        {visible.length === 0 ? (
          <p className="muted px-5 py-14 text-center text-sm">{labels.empty}</p>
        ) : (
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-48">{labels.platform}</th>
                  <th>{labels.name}</th>
                  <th className="w-28 text-right">{labels.services}</th>
                  <th className="w-28">{labels.status}</th>
                  <th className="w-24 text-right">{labels.actions}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const platform = platformOf(row.platformId);
                  return (
                    <tr key={row.id}>
                      <td>
                        {platform ? (
                          <span className="flex items-center gap-2">
                            <PlatformMark platform={platform} size={16} />
                            {platform.name}
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <span className="font-medium">{row.name}</span>
                        <span className="muted mt-0.5 block truncate font-mono text-xs">/{row.slug}</span>
                      </td>
                      <td className="text-right tabular-nums">{row.serviceCount}</td>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EntityDrawer
        closeLabel={labels.close}
        open={creating || editing !== null}
        title={editing ? `${labels.edit} — ${editing.name}` : labels.new}
        onClose={close}
      >
        <CategoryForm
          key={editing?.id ?? "new"}
          row={editing}
          platforms={platforms}
          defaultPlatformId={filter || platforms[0]?.id}
          labels={labels}
          onDone={close}
        />
      </EntityDrawer>
    </>
  );
}

function CategoryForm({
  row,
  platforms,
  defaultPlatformId,
  labels,
  onDone,
}: {
  row: CategoryRow | null;
  platforms: PlatformOption[];
  defaultPlatformId?: string;
  labels: Record<string, string>;
  onDone: () => void;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(async (prev, form) => {
    const result = await saveCategoryAction(prev, form);
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

      <Field name="platformId" label={labels.platform} error={state.fieldErrors?.platformId} required>
        <select
          id="platformId"
          name="platformId"
          className="field"
          defaultValue={row?.platformId ?? defaultPlatformId ?? ""}
        >
          {platforms.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <Field name="name" label={labels.name} error={state.fieldErrors?.name} required>
        <TextInput name="name" defaultValue={row?.name} error={state.fieldErrors?.name} placeholder={labels.egName} />
      </Field>

      {/* Left blank it is derived from the name, which is right the first
          time and wrong after a rename — an address that moves loses whatever
          was linking to it, so it is a field rather than a mirror. */}
      <Field name="slug" label={labels.slug} error={state.fieldErrors?.slug} hint={labels.slugHint}>
        <TextInput
          name="slug"
          defaultValue={row?.slug}
          error={state.fieldErrors?.slug}
          hint={labels.slugHint}
          placeholder="follow"
        />
      </Field>

      <Field name="description" label={labels.description}>
        <textarea id="description" name="description" rows={3} className="field" defaultValue={row?.description} />
      </Field>

      <Field name="position" label={labels.position}>
        <TextInput name="position" type="number" defaultValue={String(row?.position ?? 0)} />
      </Field>

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
