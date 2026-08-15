"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createOrderRequestAction } from "@/app/actions/order-requests";
import { Icon } from "@/components/icons";

export type OrderActionState = {
  orderId: string;
  canRefill: boolean;
  canCancel: boolean;
  /** Type of an already-open request, if any. */
  openRequest: string | null;
  /** Where "order this again" goes, or null if the service no longer sells. */
  reorderHref: string | null;
};

export default function OrderActions({
  order,
  labels,
}: {
  order: OrderActionState;
  labels: Record<string, string>;
}) {
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(order.openRequest);
  const [pending, start] = useTransition();

  const send = (type: string) => {
    setError("");
    start(async () => {
      const result = await createOrderRequestAction(order.orderId, type);
      if (result.error) setError(result.error);
      else setDone(type);
    });
  };

  // Reorder is not a state the order can be in — it is available on a
  // finished order and an in-flight one alike, so it sits outside the branch
  // that decides between refill, cancel and a pending badge.
  const reorder = order.reorderHref && (
    <Link href={order.reorderHref} className="btn btn-ghost btn-sm">
      <Icon name="repeat" size={13} />
      {labels.reorder}
    </Link>
  );

  if (done) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-1">
        <span className="badge badge-info">
          <Icon name="clock" size={11} />
          {done === "refill" ? labels.refillPending : labels.cancelPending}
        </span>
        {reorder}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1">
        {order.canRefill && (
          <button type="button" onClick={() => send("refill")} disabled={pending} className="btn btn-ghost btn-sm">
            <Icon name="refresh" size={13} />
            {labels.refill}
          </button>
        )}
        {order.canCancel && (
          <button type="button" onClick={() => send("cancel")} disabled={pending} className="btn btn-ghost btn-sm">
            <Icon name="close" size={13} />
            {labels.cancel}
          </button>
        )}
        {reorder}
        {!order.canRefill && !order.canCancel && !reorder && <span className="muted text-xs">—</span>}
      </div>
      {error && (
        <p className="form-error justify-end" role="alert">
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
