"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  deleteAnnouncementAction,
  saveAnnouncementAction,
  setAnnouncementEnabledAction,
  type ActionResult,
} from "@/app/actions/admin/announcements";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import EntityDrawer from "@/components/admin/entity-drawer";
import { Icon } from "@/components/icons";

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  level: string;
  enabled: boolean;
  createdAt: string;
};

const LEVELS = ["info", "success", "warning", "danger"];

export default function AnnouncementManager({
  rows,
  labels,
}: {
  rows: AnnouncementRow[];
  labels: Record<string, string>;
}) {
  const [editing, setEditing] = useState<AnnouncementRow | null>(null);
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
                <span className={`badge badge-${row.level === "danger" ? "danger" : row.level}`}>
                  {labels[`level.${row.level}`] ?? row.level}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{row.title}</p>
                  <p className="muted mt-0.5 line-clamp-2 text-sm">{row.body}</p>
                  <p className="muted mt-1 text-xs">{row.createdAt}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="flex cursor-pointer items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      disabled={pending}
                      onChange={(e) => run(() => setAnnouncementEnabledAction(row.id, e.target.checked))}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    {row.enabled ? labels.shown : labels.hidden}
                  </label>
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
                      if (confirm(labels.confirmDelete)) run(() => deleteAnnouncementAction(row.id));
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
        <AnnouncementDrawer
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

function AnnouncementDrawer({
  row,
  labels,
  onClose,
}: {
  row: AnnouncementRow | null;
  labels: Record<string, string>;
  onClose: () => void;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(saveAnnouncementAction, {});
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <EntityDrawer open title={row ? labels.edit : labels.new} onClose={onClose}>
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

        <Field name="body" label={labels.message} error={state.fieldErrors?.body} required>
          <textarea
            id="body"
            name="body"
            rows={4}
            className={`field ${state.fieldErrors?.body ? "field-error" : ""}`}
            defaultValue={row?.body ?? ""}
          />
        </Field>

        <Field name="level" label={labels.level}>
          <select id="level" name="level" className="field" defaultValue={row?.level ?? "info"}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {labels[`level.${l}`] ?? l}
              </option>
            ))}
          </select>
        </Field>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={row?.enabled ?? true}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          {labels.shown}
        </label>

        <SubmitButton className="btn btn-primary w-full">
          <Icon name="check" size={16} />
          {labels.save}
        </SubmitButton>
      </form>
    </EntityDrawer>
  );
}
