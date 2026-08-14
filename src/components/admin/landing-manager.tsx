"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  deleteFaqAction,
  deleteTestimonialAction,
  saveFaqAction,
  saveTestimonialAction,
  type ActionResult,
} from "@/app/actions/admin/landing";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import EntityDrawer from "@/components/admin/entity-drawer";
import ImageUpload from "@/components/admin/image-upload";
import { Icon } from "@/components/icons";

export type TestimonialRow = {
  id: string;
  name: string;
  role: string;
  body: string;
  rating: number;
  avatar: string;
  visible: boolean;
  position: number;
};

export type FaqRow = {
  id: string;
  question: string;
  answer: string;
  visible: boolean;
  position: number;
};

/**
 * The two lists the landing page reads from.
 *
 * Both sit on one screen because an operator setting up their home page is
 * doing one job, and because both behave the same way when empty: the
 * landing page leaves the section out entirely rather than showing a heading
 * over nothing.
 */
export default function LandingManager({
  testimonials,
  faqs,
  labels,
}: {
  testimonials: TestimonialRow[];
  faqs: FaqRow[];
  labels: Record<string, string>;
}) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const [quote, setQuote] = useState<TestimonialRow | null>(null);
  const [newQuote, setNewQuote] = useState(false);
  const [faq, setFaq] = useState<FaqRow | null>(null);
  const [newFaq, setNewFaq] = useState(false);

  const run = (fn: () => Promise<ActionResult>) => {
    setError("");
    start(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
    });
  };

  return (
    <>
      <h2 className="text-2xl font-bold tracking-tight">{labels.title}</h2>

      {error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">{labels.quotes}</h3>
          <button type="button" onClick={() => setNewQuote(true)} className="btn btn-primary btn-sm">
            <Icon name="plus" size={15} />
            {labels.newQuote}
          </button>
        </div>

        <div className="card overflow-hidden">
          {testimonials.length === 0 ? (
            <p className="muted px-5 py-12 text-center text-sm">{labels.noQuotes}</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {testimonials.map((row) => (
                <li key={row.id} className="flex flex-wrap items-start gap-3 p-4 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {row.name}
                      {row.role && <span className="muted font-normal"> · {row.role}</span>}
                      {!row.visible && <span className="badge badge-muted ml-2">{labels.hidden}</span>}
                    </p>
                    <p className="muted mt-1 line-clamp-2 text-sm">{row.body}</p>
                  </div>
                  <Buttons
                    pending={pending}
                    labels={labels}
                    name={row.name}
                    onEdit={() => setQuote(row)}
                    onDelete={() => run(() => deleteTestimonialAction(row.id))}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">{labels.faqs}</h3>
          <button type="button" onClick={() => setNewFaq(true)} className="btn btn-primary btn-sm">
            <Icon name="plus" size={15} />
            {labels.newFaq}
          </button>
        </div>

        <div className="card overflow-hidden">
          {faqs.length === 0 ? (
            <p className="muted px-5 py-12 text-center text-sm">{labels.noFaqs}</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {faqs.map((row) => (
                <li key={row.id} className="flex flex-wrap items-start gap-3 p-4 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {row.question}
                      {!row.visible && <span className="badge badge-muted ml-2">{labels.hidden}</span>}
                    </p>
                    <p className="muted mt-1 line-clamp-2 text-sm">{row.answer}</p>
                  </div>
                  <Buttons
                    pending={pending}
                    labels={labels}
                    name={row.question}
                    onEdit={() => setFaq(row)}
                    onDelete={() => run(() => deleteFaqAction(row.id))}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {(quote || newQuote) && (
        <QuoteDrawer
          row={quote}
          labels={labels}
          onClose={() => {
            setQuote(null);
            setNewQuote(false);
          }}
        />
      )}

      {(faq || newFaq) && (
        <FaqDrawer
          row={faq}
          labels={labels}
          onClose={() => {
            setFaq(null);
            setNewFaq(false);
          }}
        />
      )}
    </>
  );
}

function Buttons({
  pending,
  labels,
  name,
  onEdit,
  onDelete,
}: {
  pending: boolean;
  labels: Record<string, string>;
  name: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={onEdit} className="btn btn-ghost btn-sm" aria-label={`${labels.edit} ${name}`}>
        <Icon name="edit" size={15} />
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm(labels.confirmDelete)) onDelete();
        }}
        className="btn btn-danger btn-sm"
        aria-label={`${labels.delete} ${name}`}
      >
        <Icon name="trash" size={15} />
      </button>
    </div>
  );
}

function QuoteDrawer({
  row,
  labels,
  onClose,
}: {
  row: TestimonialRow | null;
  labels: Record<string, string>;
  onClose: () => void;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(saveTestimonialAction, {});
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <EntityDrawer closeLabel={labels.close} open title={row ? labels.edit : labels.newQuote} onClose={onClose}>
      <form action={action} className="space-y-4">
        {state.error && (
          <div className="alert alert-danger" role="alert">
            <Icon name="alert" size={16} />
            <span>{state.error}</span>
          </div>
        )}

        <input type="hidden" name="id" value={row?.id ?? ""} />

        <Field name="name" label={labels.name} error={state.fieldErrors?.name} required>
          <TextInput name="name" defaultValue={row?.name ?? ""} error={state.fieldErrors?.name} />
        </Field>

        <Field name="role" label={labels.role}>
          <TextInput name="role" defaultValue={row?.role ?? ""} />
        </Field>

        <Field name="body" label={labels.quote} error={state.fieldErrors?.body} required>
          <textarea id="body" name="body" rows={5} className="field" defaultValue={row?.body ?? ""} />
        </Field>

        <Field name="rating" label={labels.rating}>
          <TextInput name="rating" type="number" min="0" max="5" defaultValue={String(row?.rating ?? 5)} />
        </Field>

        <ImageUpload
          name="avatar"
          value={row?.avatar ?? ""}
          label={labels.avatar}
          hint={labels.imageHint}
          uploadLabel={labels.upload}
          removeLabel={labels.remove}
        />

        <Field name="position" label={labels.position}>
          <TextInput name="position" type="number" defaultValue={String(row?.position ?? 0)} />
        </Field>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            name="visible"
            defaultChecked={row?.visible ?? true}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          {labels.visible}
        </label>

        <SubmitButton className="btn btn-primary w-full">{labels.save}</SubmitButton>
      </form>
    </EntityDrawer>
  );
}

function FaqDrawer({
  row,
  labels,
  onClose,
}: {
  row: FaqRow | null;
  labels: Record<string, string>;
  onClose: () => void;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(saveFaqAction, {});
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <EntityDrawer closeLabel={labels.close} open title={row ? labels.edit : labels.newFaq} onClose={onClose}>
      <form action={action} className="space-y-4">
        {state.error && (
          <div className="alert alert-danger" role="alert">
            <Icon name="alert" size={16} />
            <span>{state.error}</span>
          </div>
        )}

        <input type="hidden" name="id" value={row?.id ?? ""} />

        <Field name="question" label={labels.question} error={state.fieldErrors?.question} required>
          <TextInput name="question" defaultValue={row?.question ?? ""} error={state.fieldErrors?.question} />
        </Field>

        <Field name="answer" label={labels.answer} error={state.fieldErrors?.answer} required>
          <textarea id="answer" name="answer" rows={6} className="field" defaultValue={row?.answer ?? ""} />
        </Field>

        <Field name="position" label={labels.position}>
          <TextInput name="position" type="number" defaultValue={String(row?.position ?? 0)} />
        </Field>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            name="visible"
            defaultChecked={row?.visible ?? true}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          {labels.visible}
        </label>

        <SubmitButton className="btn btn-primary w-full">{labels.save}</SubmitButton>
      </form>
    </EntityDrawer>
  );
}
