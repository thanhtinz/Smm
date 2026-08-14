"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  setOrderStatusAction,
  updateOrderAction,
  orderStepsAction,
  type ActionResult,
} from "@/app/actions/admin/operations";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import EntityDrawer from "@/components/admin/entity-drawer";
import OrderTimeline, { type Step } from "@/components/orders/order-timeline";
import { Icon } from "@/components/icons";

export type AdminOrderRow = {
  id: string;
  publicId: number;
  username: string;
  serviceName: string;
  link: string;
  quantity: number;
  charge: number;
  status: string;
  createdAt: string;
  startCount: number;
  remains: number;
  providerOrderId: string;
  note: string;
  comments: string;
  /** Set on subscription orders; `link` then holds the username watched. */
  subscription: { posts: number; minPerPost: number; maxPerPost: number; delay: number; expiry: string } | null;
  /** Set when this order was bought on behalf of a panel below. */
  fromChild: boolean;
};

const STATUSES = ["pending", "processing", "inprogress", "completed", "partial", "canceled", "refunded"];

export default function OrderManager({
  rows,
  money,
  labels,
}: {
  rows: AdminOrderRow[];
  /** Pre-formatted so currency conversion stays on the server. */
  money: Record<string, string>;
  labels: Record<string, string>;
}) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState("");
  const [editing, setEditing] = useState<AdminOrderRow | null>(null);

  const change = (row: AdminOrderRow, status: string) => {
    if (status === row.status) return;
    // Refunding moves money, so it is worth a confirmation.
    if ((status === "canceled" || status === "refunded") && !confirm(labels.confirmRefund)) return;
    setError("");
    setBusy(row.id);
    start(async () => {
      const result = await setOrderStatusAction(row.id, status);
      if (result.error) setError(result.error);
      setBusy("");
    });
  };

  return (
    <>
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
                  <th className="w-24">{labels.id}</th>
                  <th className="w-32">{labels.user}</th>
                  <th>{labels.service}</th>
                  <th className="w-24 text-right">{labels.quantity}</th>
                  <th className="w-28 text-right">{labels.charge}</th>
                  <th className="w-44">{labels.status}</th>
                  <th className="w-32">{labels.date}</th>
                  <th className="w-px" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-mono text-xs">#{row.publicId}</td>
                    <td className="truncate">{row.username}</td>
                    <td>
                      <span className="block max-w-[18rem] truncate font-medium">{row.serviceName}</span>
                      <a
                        href={row.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="muted block max-w-[18rem] truncate text-xs hover:text-[var(--text)]"
                      >
                        {row.link}
                      </a>
                    </td>
                    <td className="text-right tabular-nums">{row.quantity.toLocaleString()}</td>
                    <td className="text-right tabular-nums">{money[row.id]}</td>
                    <td>
                      <label htmlFor={`status-${row.id}`} className="sr-only">
                        {labels.status}
                      </label>
                      <select
                        id={`status-${row.id}`}
                        value={row.status}
                        disabled={pending && busy === row.id}
                        onChange={(e) => change(row, e.target.value)}
                        className="field py-1.5 text-xs"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {labels[`status.${s}`]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="muted text-xs">{row.createdAt}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setEditing(row)}
                        className="btn btn-ghost btn-sm"
                        aria-label={`${labels.edit} #${row.publicId}`}
                      >
                        <Icon name="edit" size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && <OrderDrawer row={editing} labels={labels} onClose={() => setEditing(null)} />}
    </>
  );
}

/**
 * Corrections an operator needs when reality and the record disagree: a
 * mistyped link, or start and remains the provider reported wrongly. The
 * charge is not here — moving money has its own audited paths.
 */
function OrderDrawer({
  row,
  labels,
  onClose,
}: {
  row: AdminOrderRow;
  labels: Record<string, string>;
  onClose: () => void;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(updateOrderAction, {});
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  // Fetched when the drawer opens rather than shipped with the list.
  const [timeline, setTimeline] = useState<{ steps: Step[]; createdAt: string } | null>(null);
  useEffect(() => {
    let live = true;
    orderStepsAction(row.id).then((result) => {
      if (live && !result.error) setTimeline({ steps: result.steps, createdAt: result.createdAt });
    });
    return () => {
      live = false;
    };
  }, [row.id]);

  return (
    <EntityDrawer closeLabel={labels.close} open title={`#${row.publicId} · ${row.serviceName}`} onClose={onClose}>
      <form action={action} className="space-y-4">
        {state.error && (
          <div className="alert alert-danger" role="alert">
            <Icon name="alert" size={16} />
            <span>{state.error}</span>
          </div>
        )}

        <input type="hidden" name="id" value={row.id} />

        <dl className="card card-pad space-y-2 text-sm">
          <Row label={labels.user} value={row.username} />
          <Row label={labels.quantity} value={row.quantity.toLocaleString()} />
          <Row label={labels.charge} value={labels[`money.${row.id}`] ?? ""} />
          {row.providerOrderId && <Row label={labels.providerOrderId} value={row.providerOrderId} mono />}
          {row.fromChild && <Row label={labels.source} value={labels.fromChild} />}
          {row.note && <Row label={labels.note} value={row.note} />}
          {row.subscription && (
            <>
              <Row label={labels.posts} value={row.subscription.posts.toLocaleString()} />
              <Row
                label={labels.perPost}
                value={`${row.subscription.minPerPost.toLocaleString()} – ${row.subscription.maxPerPost.toLocaleString()}`}
              />
              <Row label={labels.delay} value={`${row.subscription.delay} ${labels.minutes}`} />
              {row.subscription.expiry && <Row label={labels.expiry} value={row.subscription.expiry} />}
            </>
          )}
        </dl>

        {/* Read-only: the comments are what the customer paid for, and the
            quantity is derived from them, so they are not editable here. */}
        {row.comments && (
          <div>
            <span className="label">{labels.comments}</span>
            <pre className="surface-2 max-h-56 overflow-auto rounded-xl p-3 text-sm whitespace-pre-wrap">
              {row.comments}
            </pre>
          </div>
        )}

        <Field
          name="link"
          label={row.subscription ? labels.username : labels.link}
          error={state.fieldErrors?.link}
          required
        >
          <TextInput name="link" defaultValue={row.link} error={state.fieldErrors?.link} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="startCount" label={labels.startCount} error={state.fieldErrors?.startCount}>
            <TextInput
              name="startCount"
              type="number"
              min="0"
              defaultValue={String(row.startCount)}
              error={state.fieldErrors?.startCount}
            />
          </Field>
          <Field name="remains" label={labels.remains} error={state.fieldErrors?.remains}>
            <TextInput
              name="remains"
              type="number"
              min="0"
              max={row.quantity}
              defaultValue={String(row.remains)}
              error={state.fieldErrors?.remains}
            />
          </Field>
        </div>

        <SubmitButton className="btn btn-primary w-full">
          <Icon name="check" size={16} />
          {labels.save}
        </SubmitButton>
      </form>

      {timeline && (
        <section className="mt-6 border-t border-[var(--border)] pt-5">
          <h3 className="font-semibold">{labels.timeline}</h3>
          <div className="mt-4">
            <OrderTimeline steps={timeline.steps} createdAt={timeline.createdAt} labels={labels} />
          </div>
        </section>
      )}
    </EntityDrawer>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="muted shrink-0 text-xs">{label}</dt>
      <dd className={`min-w-0 truncate text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
