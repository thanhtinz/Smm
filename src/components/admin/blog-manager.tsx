"use client";

import { useActionState, useState, useTransition } from "react";
import {
  deleteBlogPostAction,
  saveBlogPostAction,
  setBlogPostPublishedAction,
  type ActionResult,
} from "@/app/actions/admin/blog";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import EntityDrawer from "@/components/admin/entity-drawer";
import ImageUpload from "@/components/admin/image-upload";
import { Icon } from "@/components/icons";

export type BlogPostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverUrl: string;
  tags: string;
  author: string;
  metaTitle: string;
  metaDescription: string;
  /** "2026-08-20T14:30" in the panel's zone, or empty for a draft. */
  publishedAt: string;
  /** Already published and the date has passed — live to a reader now. */
  live: boolean;
  /** Published with a date still ahead: it will appear on its own. */
  scheduled: boolean;
  publishedLabel: string;
};

export default function BlogManager({
  rows,
  labels,
}: {
  rows: BlogPostRow[];
  labels: Record<string, string>;
}) {
  const [editing, setEditing] = useState<BlogPostRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const close = () => {
    setEditing(null);
    setCreating(false);
  };

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
                  <p className="muted mt-0.5 line-clamp-2 text-sm">{row.excerpt}</p>
                  <p className="muted mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono">/blog/{row.slug}</span>
                    {/* Three states, not two: a post dated for next week is
                        neither a draft nor something a reader can open. */}
                    <span
                      className={`badge ${row.live ? "badge-success" : row.scheduled ? "badge-info" : "badge-muted"}`}
                    >
                      {row.live ? labels.live : row.scheduled ? labels.scheduled : labels.draft}
                    </span>
                    {row.publishedLabel && <span>{row.publishedLabel}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => setBlogPostPublishedAction(row.id, !row.publishedAt))}
                    className="btn btn-ghost btn-sm"
                  >
                    <Icon name={row.publishedAt ? "eye" : "send"} size={14} />
                    {row.publishedAt ? labels.unpublish : labels.publish}
                  </button>
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
                    disabled={pending}
                    onClick={() => {
                      if (confirm(labels.confirmDelete)) run(() => deleteBlogPostAction(row.id));
                    }}
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
        <PostForm key={editing?.id ?? "new"} row={editing} labels={labels} onDone={close} />
      </EntityDrawer>
    </>
  );
}

function PostForm({
  row,
  labels,
  onDone,
}: {
  row: BlogPostRow | null;
  labels: Record<string, string>;
  onDone: () => void;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(async (prev, form) => {
    const result = await saveBlogPostAction(prev, form);
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

      <Field name="title" label={labels.postTitle} error={state.fieldErrors?.title} required>
        <TextInput name="title" defaultValue={row?.title} error={state.fieldErrors?.title} />
      </Field>

      <Field name="slug" label={labels.slug} error={state.fieldErrors?.slug} hint={labels.slugHint}>
        <TextInput name="slug" defaultValue={row?.slug} error={state.fieldErrors?.slug} hint={labels.slugHint} />
      </Field>

      <div>
        <label htmlFor="excerpt" className="label">
          {labels.excerpt}
        </label>
        <textarea id="excerpt" name="excerpt" rows={2} defaultValue={row?.excerpt} className="field" />
        <p className="form-hint">{labels.excerptHint}</p>
      </div>

      <div>
        <label htmlFor="body" className="label">
          {labels.body}
        </label>
        <textarea id="body" name="body" rows={14} defaultValue={row?.body} className="field font-mono text-xs" />
        <p className="form-hint">{labels.bodyHint}</p>
      </div>

      <ImageUpload
        name="coverUrl"
        value={row?.coverUrl ?? ""}
        label={labels.cover}
        hint={labels.coverHint}
        removeLabel={labels.remove}
        uploadLabel={labels.upload}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="author" label={labels.author}>
          <TextInput name="author" defaultValue={row?.author} />
        </Field>
        <Field name="tags" label={labels.tags} hint={labels.tagsHint}>
          <TextInput name="tags" defaultValue={row?.tags} hint={labels.tagsHint} />
        </Field>
      </div>

      <Field name="metaTitle" label={labels.metaTitle} hint={labels.metaHint}>
        <TextInput name="metaTitle" defaultValue={row?.metaTitle} hint={labels.metaHint} />
      </Field>

      <div>
        <label htmlFor="metaDescription" className="label">
          {labels.metaDescription}
        </label>
        <textarea
          id="metaDescription"
          name="metaDescription"
          rows={2}
          defaultValue={row?.metaDescription}
          className="field"
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          name="published"
          defaultChecked={Boolean(row?.publishedAt)}
          className="h-4 w-4 accent-[var(--primary)]"
        />
        {labels.publishedFlag}
      </label>

      <Field
        name="publishedAt"
        label={labels.publishedAt}
        error={state.fieldErrors?.publishedAt}
        hint={labels.publishedAtHint}
      >
        <TextInput
          name="publishedAt"
          type="datetime-local"
          defaultValue={row?.publishedAt}
          error={state.fieldErrors?.publishedAt}
          hint={labels.publishedAtHint}
        />
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
