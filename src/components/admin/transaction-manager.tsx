"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { approveTransactionAction, rejectTransactionAction, type ActionResult } from "@/app/actions/admin/operations";
import StatusBadge from "@/components/ui/status-badge";
import { Icon } from "@/components/icons";

export type AdminTxRow = {
  id: string;
  publicId: number;
  username: string;
  method: string;
  paid: string;
  credited: string;
  status: string;
  reference: string;
  note: string;
  createdAt: string;
};

const STATUSES = ["pending", "review", "completed", "failed", "canceled"];

export default function TransactionManager({
  rows,
  activeStatus,
  page,
  totalPages,
  labels,
}: {
  rows: AdminTxRow[];
  activeStatus: string;
  page: number;
  totalPages: number;
  labels: Record<string, string>;
}) {
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
      <div className="scroll-x -mx-1 px-1">
        <div className="flex gap-2 pb-1">
          <Tab href="/admin/transactions" active={!activeStatus} label={labels.all} />
          {STATUSES.map((s) => (
            <Tab
              key={s}
              href={`/admin/transactions?status=${s}`}
              active={activeStatus === s}
              label={labels[`status.${s}`]}
            />
          ))}
        </div>
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
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-24">{labels.id}</th>
                  <th className="w-32">{labels.user}</th>
                  <th>{labels.method}</th>
                  <th className="w-32 text-end">{labels.paid}</th>
                  <th className="w-32 text-end">{labels.credited}</th>
                  <th className="w-32">{labels.status}</th>
                  <th className="w-32">{labels.date}</th>
                  <th className="w-32 text-end">{labels.actions}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-mono text-xs">#{row.publicId}</td>
                    <td className="truncate">{row.username}</td>
                    <td>
                      <span className="block truncate">{row.method}</span>
                      {row.reference && <span className="muted block truncate font-mono text-xs">{row.reference}</span>}
                      {row.note && <span className="muted block truncate text-xs">{row.note}</span>}
                    </td>
                    <td className="text-end tabular-nums">{row.paid}</td>
                    <td className="text-end font-semibold tabular-nums">{row.credited}</td>
                    <td>
                      <StatusBadge status={row.status} label={labels[`status.${row.status}`] ?? row.status} />
                    </td>
                    <td className="muted text-xs">{row.createdAt}</td>
                    <td>
                      {row.status === "pending" || row.status === "review" ? (
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                              if (confirm(labels.confirmApprove)) run(() => approveTransactionAction(row.id));
                            }}
                            className="btn btn-ghost btn-sm"
                            title={labels.approve}
                          >
                            <Icon name="check" size={14} />
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                              const reason = prompt(labels.reason) ?? "";
                              run(() => rejectTransactionAction(row.id, reason));
                            }}
                            className="btn btn-danger btn-sm"
                            title={labels.reject}
                          >
                            <Icon name="close" size={14} />
                          </button>
                        </div>
                      ) : (
                        <span className="muted block text-end text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <nav className="flex items-center justify-between" aria-label={labels.pagination}>
          <PageLink status={activeStatus} page={page - 1} disabled={page <= 1} icon="chevronLeft" />
          <span className="muted text-sm tabular-nums">
            {page} / {totalPages}
          </span>
          <PageLink status={activeStatus} page={page + 1} disabled={page >= totalPages} icon="chevronRight" />
        </nav>
      )}
    </>
  );
}

function Tab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] text-[var(--primary)]"
          : "muted border-[var(--border)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
      }`}
    >
      {label}
    </Link>
  );
}

function PageLink({
  status,
  page,
  disabled,
  icon,
}: {
  status: string;
  page: number;
  disabled: boolean;
  icon: "chevronLeft" | "chevronRight";
}) {
  if (disabled) {
    return (
      <span className="btn btn-ghost btn-sm opacity-40" aria-disabled>
        <Icon name={icon} size={15} />
      </span>
    );
  }
  const sp = new URLSearchParams();
  if (status) sp.set("status", status);
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return (
    <Link href={qs ? `/admin/transactions?${qs}` : "/admin/transactions"} className="btn btn-ghost btn-sm">
      <Icon name={icon} size={15} />
    </Link>
  );
}
