"use client";

import { useState, useTransition } from "react";
import { setOrderStatusAction } from "@/app/actions/admin/operations";
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
