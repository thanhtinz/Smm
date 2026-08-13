"use client";

import { useActionState, useMemo, useState } from "react";
import { massOrderAction, type MassOrderState } from "@/app/actions/orders";
import SubmitButton from "@/components/ui/submit-button";
import { Icon } from "@/components/icons";
import { formatCurrency, type Currency, type ServiceOption } from "./new-order-form";

export type MassLabels = Record<
  "title" | "format" | "submit" | "lines" | "estimated" | "balance" | "placed" | "failed" | "line",
  string
>;

/**
 * Bulk entry in the format every SMM panel uses: one order per line as
 * `service_id | link | quantity`. The estimate below the box is computed
 * client-side from the same catalogue the server validates against.
 */
export default function MassOrderForm({
  services,
  balance,
  currency,
  labels,
}: {
  services: ServiceOption[];
  balance: number;
  currency: Currency;
  labels: MassLabels;
}) {
  const [state, action] = useActionState<MassOrderState, FormData>(massOrderAction, {});
  const [bulk, setBulk] = useState("");

  const byPublicId = useMemo(() => new Map(services.map((s) => [String(s.publicId), s])), [services]);

  const preview = useMemo(() => {
    const lines = bulk.split("\n").map((l) => l.trim()).filter(Boolean);
    let valid = 0;
    let charge = 0;
    for (const line of lines) {
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length !== 3) continue;
      const service = byPublicId.get(parts[0]);
      const quantity = Number(parts[2]);
      if (!service || !Number.isInteger(quantity) || quantity < service.min || quantity > service.max) continue;
      valid += 1;
      charge += Math.round((service.rate * quantity) / 1000);
    }
    return { count: lines.length, valid, charge };
  }, [bulk, byPublicId]);

  const fmt = (base: number) => formatCurrency(base, currency);

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-2">
      <div className="card card-pad min-w-0 space-y-4">
        {state.error && (
          <div className="alert alert-danger" role="alert">
            <Icon name="alert" size={16} />
            <span>{state.error}</span>
          </div>
        )}

        <div>
          <label htmlFor="bulk" className="label">
            {labels.title}
          </label>
          <textarea
            id="bulk"
            name="bulk"
            rows={12}
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            spellCheck={false}
            className="field font-mono text-[0.82rem] leading-relaxed"
            placeholder={"1001 | https://instagram.com/profile | 1000\n1008 | https://tiktok.com/@profile | 5000"}
          />
          <p className="form-hint">{labels.format}</p>
        </div>

        {state.results && state.results.length > 0 && (
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
            {state.results.map((r) => (
              <li key={r.line} className="flex items-start gap-2.5 px-3.5 py-2.5 text-xs">
                <span className={`mt-0.5 shrink-0 ${r.ok ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                  <Icon name={r.ok ? "checkCircle" : "alert"} size={14} />
                </span>
                <span className="muted shrink-0 font-mono">
                  {labels.line} {r.line}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono">{r.raw}</span>
                <span className={`shrink-0 font-medium ${r.ok ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                  {r.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <aside className="min-w-0">
        <div className="card card-pad lg:sticky lg:top-20">
          <dl className="space-y-2.5 text-sm">
            <Row label={labels.lines} value={`${preview.valid} / ${preview.count}`} />
          </dl>

          <div className="divider my-4" />

          <div>
            <span className="muted text-xs tracking-wide uppercase">{labels.estimated}</span>
            <p className="mt-0.5 text-2xl leading-tight font-bold tabular-nums">{fmt(preview.charge)}</p>
          </div>

          <p className="muted mt-2 flex items-center justify-between text-xs">
            <span>{labels.balance}</span>
            <span className="tabular-nums">{fmt(balance)}</span>
          </p>

          <SubmitButton className="btn btn-primary mt-4 w-full">
            <Icon name="layers" size={16} />
            {labels.submit}
          </SubmitButton>

          {typeof state.placed === "number" && state.placed > 0 && (
            <div className="alert alert-success mt-4" role="status">
              <Icon name="checkCircle" size={15} />
              <span>{labels.placed.replace("{n}", String(state.placed))}</span>
            </div>
          )}
        </div>
      </aside>
    </form>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="muted min-w-0 text-[0.82rem]">{label}</dt>
      <dd className="shrink-0 text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}
