"use client";

import { useActionState, useState, useTransition } from "react";
import {
  deleteSavedReplyAction,
  saveSavedReplyAction,
  type ActionResult,
} from "@/app/actions/admin/saved-replies";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import EntityDrawer from "@/components/admin/entity-drawer";
import { Icon } from "@/components/icons";

export type SavedReplyRow = {
  id: string;
  title: string;
  body: string;
  /** Blank offers the reply on every ticket. */
  category: string;
  position: number;
  uses: number;
};

export default function SavedReplyManager({
  rows,
  categories,
  labels,
}: {
  rows: SavedReplyRow[];
  /** The ticket categories a reply can be tied to. */
  categories: { value: string; label: string }[];
  labels: Record<string, string>;
}) {
  const [editing, setEditing] = useState<SavedReplyRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const close = () => {
    setEditing(null);
    setCreating(false);
  };

  const remove = (row: SavedReplyRow) => {
    if (!confirm(labels.confirmDelete)) return;
    setError("");
    start(async () => {
      const result = await deleteSavedReplyAction(row.id);
      if (result.error) setError(result.error);
    });
  };

  const categoryLabel = (value: string) =>
    value ? (categories.find((c) => c.value === value)?.label ?? value) : labels.anyCategory;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{labels.title}</h2>
          <p className="muted text-sm">{labels.hint}</p>
        </div>
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
          <ul className="divide-y divide-[var(--border)]">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-start gap-3 p-4 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{row.title}</p>
                  <p className="muted mt-0.5 line-clamp-2 text-sm whitespace-pre-wrap">{row.body}</p>
                  <p className="muted mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="badge badge-muted">{categoryLabel(row.category)}</span>
                    <span>{labels.uses.replace("{n}", String(row.uses))}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(row)}
                    className="btn btn-ghost btn-sm"
                    aria-label={`${labels.edit} ${row.title}`}
                  >
                    <Icon name="edit" size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(row)}
                    disabled={pending}
                    className="btn btn-danger btn-sm"
                    aria-label={`${labels.delete} ${row.title}`}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <EntityDrawer
        closeLabel={labels.close}
        open={creating || editing !== null}
        title={editing ? `${labels.edit} — ${editing.title}` : labels.new}
        onClose={close}
      >
        <ReplyForm
          key={editing?.id ?? "new"}
          row={editing}
          categories={categories}
          labels={labels}
          onDone={close}
        />
      </EntityDrawer>
    </>
  );
}

function ReplyForm({
  row,
  categories,
  labels,
  onDone,
}: {
  row: SavedReplyRow | null;
  categories: { value: string; label: string }[];
  labels: Record<string, string>;
  onDone: () => void;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(async (prev, form) => {
    const result = await saveSavedReplyAction(prev, form);
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

      <Field name="title" label={labels.replyTitle} error={state.fieldErrors?.title} required>
        <TextInput
          name="title"
          defaultValue={row?.title}
          error={state.fieldErrors?.title}
          placeholder={labels.egTitle}
        />
      </Field>

      <div>
        <label htmlFor="body" className="label">
          {labels.body}
        </label>
        <textarea
          id="body"
          name="body"
          rows={8}
          defaultValue={row?.body}
          className="field"
          placeholder={labels.egBody}
          aria-invalid={state.fieldErrors?.body ? true : undefined}
        />
        {state.fieldErrors?.body && (
          <p className="form-error" role="alert">
            <Icon name="alert" size={14} />
            <span>{state.fieldErrors.body}</span>
          </p>
        )}
      </div>

      <Field name="category" label={labels.category} hint={labels.categoryHint}>
        <select id="category" name="category" defaultValue={row?.category ?? ""} className="field">
          <option value="">{labels.anyCategory}</option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>

      <Field name="position" label={labels.position}>
        <TextInput name="position" type="number" defaultValue={String(row?.position ?? 0)} />
      </Field>

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
