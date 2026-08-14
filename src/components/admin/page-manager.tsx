"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  deletePageAction,
  savePageAction,
  setPagePublishedAction,
  type ActionResult,
} from "@/app/actions/admin/pages";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import EntityDrawer from "@/components/admin/entity-drawer";
import { Icon } from "@/components/icons";

export type PageRow = {
  id: string;
  slug: string;
  title: string;
  body: string;
  published: boolean;
  showInFooter: boolean;
  position: number;
  updatedAt: string;
};

export default function PageManager({ rows, labels }: { rows: PageRow[]; labels: Record<string, string> }) {
  const [editing, setEditing] = useState<PageRow | null>(null);
  const [creating, setCreating] = useState(false);
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
                  <p className="muted mt-0.5 font-mono text-xs">/p/{row.slug}</p>
                  <p className="muted mt-1 text-xs">
                    {row.updatedAt}
                    {row.showInFooter ? ` · ${labels.footer}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="flex cursor-pointer items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={row.published}
                      disabled={pending}
                      onChange={(e) => run(() => setPagePublishedAction(row.id, e.target.checked))}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    {row.published ? labels.published : labels.hidden}
                  </label>
                  <a
                    href={`/p/${row.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                    aria-label={`${labels.view} ${row.title}`}
                  >
                    <Icon name="external" size={15} />
                  </a>
                  <button
                    type="button"
                    onClick={() => setEditing(row)}
                    className="btn btn-ghost btn-sm"
                    aria-label={`${labels.edit} ${row.title}`}
                  >
                    <Icon name="edit" size={15} />
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (confirm(labels.confirmDelete)) run(() => deletePageAction(row.id));
                    }}
                    className="btn btn-danger btn-sm"
                    aria-label={`${labels.delete} ${row.title}`}
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(creating || editing) && (
        <PageDrawer
          row={editing}
          labels={labels}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </>
  );
}

function PageDrawer({
  row,
  labels,
  onClose,
}: {
  row: PageRow | null;
  labels: Record<string, string>;
  onClose: () => void;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(savePageAction, {});
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <EntityDrawer closeLabel={labels.close} open title={row ? labels.edit : labels.new} onClose={onClose}>
      <form action={action} className="space-y-4">
        {state.error && (
          <div className="alert alert-danger" role="alert">
            <Icon name="alert" size={16} />
            <span>{state.error}</span>
          </div>
        )}

        <input type="hidden" name="id" value={row?.id ?? ""} />

        <Field name="title" label={labels.heading} error={state.fieldErrors?.title} required>
          <TextInput name="title" defaultValue={row?.title ?? ""} error={state.fieldErrors?.title} />
        </Field>

        <Field name="slug" label={labels.address} error={state.fieldErrors?.slug}>
          <TextInput name="slug" defaultValue={row?.slug ?? ""} error={state.fieldErrors?.slug} />
        </Field>

        <Field name="body" label={labels.content}>
          <textarea
            id="body"
            name="body"
            rows={14}
            className="field font-mono text-xs"
            defaultValue={row?.body ?? ""}
          />
        </Field>

        <Field name="position" label={labels.position}>
          <TextInput name="position" type="number" defaultValue={String(row?.position ?? 0)} />
        </Field>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            name="published"
            defaultChecked={row?.published ?? true}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          {labels.published}
        </label>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            name="showInFooter"
            defaultChecked={row?.showInFooter ?? true}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          {labels.footer}
        </label>

        <SubmitButton className="btn btn-primary w-full">
          <Icon name="check" size={16} />
          {labels.save}
        </SubmitButton>
      </form>
    </EntityDrawer>
  );
}
