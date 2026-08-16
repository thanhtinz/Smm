"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import {
  adjustBalanceAction,
  setUserBanAction,
  setUserRoleAction,
  type ActionResult,
} from "@/app/actions/admin/operations";
import { setUserTierAction } from "@/app/actions/admin/tiers";
import { resetUserRatesAction } from "@/app/actions/admin/user-access";
import { clearForUserAction } from "@/app/actions/two-factor";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import EntityDrawer from "@/components/admin/entity-drawer";
import { Icon } from "@/components/icons";

export type AdminUserRow = {
  id: string;
  publicId: number;
  username: string;
  email: string;
  role: string;
  balance: string;
  spent: string;
  banned: boolean;
  banReason: string;
  createdAt: string;
  /** Set when the account has two-step verification on. */
  twoFactor: boolean;
  /** Empty when the customer follows the spend ladder rather than an override. */
  tierId: string;
  tierName: string;
};

export type TierOption = { id: string; name: string };

export default function UserManager({
  rows,
  tiers,
  labels,
}: {
  rows: AdminUserRow[];
  tiers: TierOption[];
  labels: Record<string, string>;
}) {
  const [adjusting, setAdjusting] = useState<AdminUserRow | null>(null);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<ActionResult>) => {
    setError("");
    start(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
    });
  };

  const allPicked = rows.length > 0 && picked.length === rows.length;
  const toggle = (id: string) =>
    setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);

  return (
    <>
      {error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* A promotion ends for everyone at once, so the reset does too. Only
          shown once something is selected — an always-present bar of bulk
          actions is a row of buttons that do nothing most of the time. */}
      {picked.length > 0 && (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <span className="text-sm font-medium">{labels.picked.replace("{n}", String(picked.length))}</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!confirm(labels.confirmResetRates)) return;
                run(async () => {
                  const result = await resetUserRatesAction(picked);
                  if (!result.error) setPicked([]);
                  return result;
                });
              }}
              className="btn btn-ghost btn-sm"
            >
              <Icon name="refresh" size={14} />
              {labels.resetRates}
            </button>
            <button type="button" onClick={() => setPicked([])} className="btn btn-ghost btn-sm">
              {labels.cancel}
            </button>
          </div>
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
                  <th className="w-10">
                    <label htmlFor="pick-all" className="sr-only">
                      {labels.selectAll}
                    </label>
                    <input
                      id="pick-all"
                      type="checkbox"
                      checked={allPicked}
                      onChange={() => setPicked(allPicked ? [] : rows.map((r) => r.id))}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                  </th>
                  <th className="w-20">ID</th>
                  <th>{labels.user}</th>
                  <th className="w-32 text-end">{labels.balance}</th>
                  <th className="w-32 text-end">{labels.spent}</th>
                  <th className="w-36">{labels.tier}</th>
                  <th className="w-36">{labels.role}</th>
                  <th className="w-28">{labels.status}</th>
                  <th className="w-32 text-end">{labels.actions}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <label htmlFor={`pick-${row.id}`} className="sr-only">
                        {row.username}
                      </label>
                      <input
                        id={`pick-${row.id}`}
                        type="checkbox"
                        checked={picked.includes(row.id)}
                        onChange={() => toggle(row.id)}
                        className="h-4 w-4 accent-[var(--primary)]"
                      />
                    </td>
                    <td className="muted font-mono text-xs">{row.publicId}</td>
                    <td>
                      {/* The name is the way in to everything the row cannot
                          hold: the rate card, the access rules, the methods. */}
                      <Link href={`/admin/users/${row.id}`} className="font-medium hover:underline">
                        {row.username}
                      </Link>
                      <span className="muted mt-0.5 block truncate text-xs">{row.email}</span>
                    </td>
                    <td className="text-end font-semibold tabular-nums">{row.balance}</td>
                    <td className="muted text-end tabular-nums">{row.spent}</td>
                    <td>
                      <label htmlFor={`tier-${row.id}`} className="sr-only">
                        {labels.tier}
                      </label>
                      <select
                        id={`tier-${row.id}`}
                        value={row.tierId}
                        disabled={pending}
                        onChange={(e) => run(() => setUserTierAction(row.id, e.target.value || null))}
                        className="field py-1.5 text-xs"
                      >
                        <option value="">
                          {row.tierName ? `${labels.auto} · ${row.tierName}` : labels.auto}
                        </option>
                        {tiers.map((tier) => (
                          <option key={tier.id} value={tier.id}>
                            {tier.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <label htmlFor={`role-${row.id}`} className="sr-only">
                        {labels.role}
                      </label>
                      <select
                        id={`role-${row.id}`}
                        value={row.role}
                        disabled={pending}
                        onChange={(e) => run(() => setUserRoleAction(row.id, e.target.value))}
                        className="field py-1.5 text-xs"
                      >
                        <option value="user">user</option>
                        <option value="support">support</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td>
                      <span className={`badge ${row.banned ? "badge-danger" : "badge-success"}`}>
                        <Icon name={row.banned ? "lock" : "check"} size={11} />
                        {row.banned ? labels.suspended : labels.active}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setAdjusting(row)}
                          className="btn btn-ghost btn-sm"
                          title={labels.adjustBalance}
                        >
                          <Icon name="wallet" size={14} />
                        </button>
                        {/* The way back in for a member of staff who has lost
                            both the phone and the recovery sheet. */}
                        {row.twoFactor && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                              if (confirm(labels.confirmClear2fa)) run(() => clearForUserAction(row.id));
                            }}
                            className="btn btn-ghost btn-sm"
                            title={labels.clear2fa}
                          >
                            <Icon name="shield" size={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            if (row.banned) return run(() => setUserBanAction(row.id, false));
                            const reason = prompt(labels.reason) ?? "";
                            run(() => setUserBanAction(row.id, true, reason));
                          }}
                          className={row.banned ? "btn btn-ghost btn-sm" : "btn btn-danger btn-sm"}
                          title={row.banned ? labels.unsuspend : labels.suspend}
                        >
                          <Icon name={row.banned ? "eye" : "lock"} size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EntityDrawer
        closeLabel={labels.close}
        open={adjusting !== null}
        title={`${labels.adjustBalance} — ${adjusting?.username ?? ""}`}
        onClose={() => setAdjusting(null)}
      >
        {adjusting && (
          <AdjustForm key={adjusting.id} row={adjusting} labels={labels} onDone={() => setAdjusting(null)} />
        )}
      </EntityDrawer>
    </>
  );
}

function AdjustForm({
  row,
  labels,
  onDone,
}: {
  row: AdminUserRow;
  labels: Record<string, string>;
  onDone: () => void;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(async (prev, form) => {
    const result = await adjustBalanceAction(prev, form);
    if (result.ok) onDone();
    return result;
  }, {});

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="userId" value={row.id} />

      {state.error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{state.error}</span>
        </div>
      )}

      <p className="muted text-sm">
        {labels.balance}: <strong className="text-[var(--text)]">{row.balance}</strong>
      </p>

      <Field
        name="amount"
        label={labels.amount}
        error={state.fieldErrors?.amount}
        hint={labels.adjustHint}
        required
      >
        <TextInput
          name="amount"
          type="number"
          step="any"
          autoFocus
          error={state.fieldErrors?.amount}
          hint={labels.adjustHint}
          placeholder="100000"
        />
      </Field>

      <Field name="note" label={labels.note}>
        <TextInput name="note" placeholder="" />
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
