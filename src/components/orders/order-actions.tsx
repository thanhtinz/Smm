"use client";

import { useState, useTransition } from "react";
import { createOrderRequestAction } from "@/app/actions/order-requests";
import { Icon } from "@/components/icons";

export type OrderActionState = {
  orderId: string;
  canRefill: boolean;
  canCancel: boolean;
  /** Type of an already-open request, if any. */
  openRequest: string | null;
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

  if (done) {
    return (
      <span className="badge badge-info">
        <Icon name="clock" size={11} />
        {done === "refill" ? labels.refillPending : labels.cancelPending}
      </span>
    );
  }

  if (!order.canRefill && !order.canCancel) return <span className="muted text-xs">—</span>;

  return (
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
      {error && (
        <p className="form-error w-full justify-end" role="alert">
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
