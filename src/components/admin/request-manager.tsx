"use client";

import { useState, useTransition } from "react";
import { resolveOrderRequestAction } from "@/app/actions/order-requests";
import StatusBadge from "@/components/ui/status-badge";
import { Icon } from "@/components/icons";

export type RequestRow = {
  id: string;
  publicId: number;
  type: string;
  status: string;
  username: string;
  orderPublicId: number;
  serviceName: string;
  link: string;
  charge: string;
  note: string;
  createdAt: string;
};

export default function RequestManager({ rows, labels }: { rows: RequestRow[]; labels: Record<string, string> }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const resolve = (row: RequestRow, decision: string) => {
    if (row.type === "cancel" && decision === "approved" && !confirm(labels.confirmRefund)) return;
    setError("");
    start(async () => {
      const note = decision === "rejected" ? (prompt(labels.reason) ?? "") : "";
      const result = await resolveOrderRequestAction(row.id, decision, note);
      if (result.error) setError(result.error);
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
                  <th className="w-20">ID</th>
                  <th className="w-28">{labels.type}</th>
                  <th className="w-32">{labels.user}</th>
                  <th>{labels.order}</th>
                  <th className="w-28 text-right">{labels.charge}</th>
                  <th className="w-32">{labels.status}</th>
                  <th className="w-32 text-right">{labels.actions}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="muted font-mono text-xs">{row.publicId}</td>
                    <td>
                      <span className={`badge ${row.type === "refill" ? "badge-info" : "badge-warning"}`}>
                        <Icon name={row.type === "refill" ? "refresh" : "close"} size={11} />
                        {row.type === "refill" ? labels.refill : labels.cancel}
                      </span>
                    </td>
                    <td className="truncate">{row.username}</td>
                    <td>
                      <span className="block truncate font-medium">
                        #{row.orderPublicId} · {row.serviceName}
                      </span>
                      <span className="muted block max-w-[18rem] truncate text-xs">{row.link}</span>
                      {row.note && <span className="muted block truncate text-xs">{row.note}</span>}
                    </td>
                    <td className="text-right tabular-nums">{row.charge}</td>
                    <td>
                      <StatusBadge status={row.status === "pending" ? "pending" : row.status === "rejected" ? "canceled" : "completed"} label={labels[`decision.${row.status}`] ?? row.status} />
                    </td>
                    <td>
                      {row.status === "pending" || row.status === "approved" ? (
                        <div className="flex justify-end gap-1">
                          {/* Approved means "passed on" where there is a panel
                              or provider above; the level that actually does
                              the work is the one that marks it done. */}
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => resolve(row, row.status === "pending" ? "approved" : "completed")}
                            className="btn btn-ghost btn-sm"
                            title={row.status === "pending" ? labels.approve : labels.complete}
                          >
                            <Icon name={row.status === "pending" ? "check" : "checkCircle"} size={14} />
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => resolve(row, "rejected")}
                            className="btn btn-danger btn-sm"
                            title={labels.reject}
                          >
                            <Icon name="close" size={14} />
                          </button>
                        </div>
                      ) : (
                        <span className="muted block text-right text-xs">{row.createdAt}</span>
                      )}
                    </td>
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
