"use client";

import { useMemo, useState, useTransition } from "react";
import {
  copyUserRatesAction,
  resetUserRatesAction,
  setUserAccessRulesAction,
  setUserDiscountAction,
  setUserPaymentMethodsAction,
  setUserRateAction,
  type ActionResult,
} from "@/app/actions/admin/user-access";
import { Icon } from "@/components/icons";

export type RuleRow = { rule: string; label: string; denied: boolean };
export type MethodRow = { id: string; name: string; enabled: boolean; allowed: boolean };
export type RateRow = {
  id: string;
  publicId: number;
  name: string;
  category: string;
  /** The catalogue price, formatted. */
  list: string;
  /** What their tier alone would charge, formatted. */
  tier: string;
  /** What they are charged today, formatted. */
  effective: string;
  /** The override in the base currency, as typed. Empty means none. */
  override: string;
};

/**
 * The per-customer controls.
 *
 * Every control here saves on its own rather than through one big form. They
 * are unrelated decisions — a discount, a suspension of deposits, one service
 * repriced — and batching them behind a single Save means an operator who
 * changes one thing has to think about the other twelve.
 */
export default function UserAccessPanel({
  userId,
  discountPercent,
  tierName,
  tierDiscount,
  rules,
  methods,
  restricted,
  services,
  labels,
}: {
  userId: string;
  discountPercent: number;
  tierName: string;
  tierDiscount: number;
  rules: RuleRow[];
  methods: MethodRow[];
  restricted: boolean;
  services: RateRow[];
  labels: Record<string, string>;
}) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<ActionResult>) => {
    setError("");
    start(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
      else if (result.fieldErrors) setError(Object.values(result.fieldErrors)[0] ?? "");
    });
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <DiscountCard
          userId={userId}
          value={discountPercent}
          tierName={tierName}
          tierDiscount={tierDiscount}
          pending={pending}
          run={run}
          labels={labels}
        />
        <RulesCard userId={userId} rules={rules} pending={pending} run={run} labels={labels} />
      </div>

      <MethodsCard
        userId={userId}
        methods={methods}
        restricted={restricted}
        pending={pending}
        run={run}
        labels={labels}
      />

      <RateCard userId={userId} services={services} pending={pending} run={run} labels={labels} />
    </div>
  );
}

type Runner = (fn: () => Promise<ActionResult>) => void;

function DiscountCard({
  userId,
  value,
  tierName,
  tierDiscount,
  pending,
  run,
  labels,
}: {
  userId: string;
  value: number;
  tierName: string;
  tierDiscount: number;
  pending: boolean;
  run: Runner;
  labels: Record<string, string>;
}) {
  const [percent, setPercent] = useState(String(value));

  return (
    <section className="card space-y-3 p-5">
      <h3 className="font-semibold">{labels.pricing}</h3>

      <div>
        <label htmlFor="discountPercent" className="label">
          {labels.discount}
        </label>
        <div className="flex gap-2">
          <input
            id="discountPercent"
            name="discountPercent"
            type="number"
            min={0}
            max={99}
            step="any"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            className="field"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setUserDiscountAction(userId, Number(percent)))}
            className="btn btn-primary"
          >
            <Icon name="check" size={15} />
            {labels.save}
          </button>
        </div>
        <p className="form-hint">{labels.discountHint}</p>
      </div>

      {tierDiscount > 0 && (
        <p className="muted text-sm">
          {labels.tierGives.replace("{tier}", tierName).replace("{percent}", String(tierDiscount))}
        </p>
      )}
    </section>
  );
}

function RulesCard({
  userId,
  rules,
  pending,
  run,
  labels,
}: {
  userId: string;
  rules: RuleRow[];
  pending: boolean;
  run: Runner;
  labels: Record<string, string>;
}) {
  const [denied, setDenied] = useState<string[]>(rules.filter((r) => r.denied).map((r) => r.rule));

  const toggle = (rule: string) => {
    const next = denied.includes(rule) ? denied.filter((r) => r !== rule) : [...denied, rule];
    setDenied(next);
    run(() => setUserAccessRulesAction(userId, next));
  };

  return (
    <section className="card space-y-3 p-5">
      <div>
        <h3 className="font-semibold">{labels.rules}</h3>
        <p className="muted text-sm">{labels.rulesHint}</p>
      </div>

      <ul className="space-y-1.5">
        {rules.map((rule) => (
          <li key={rule.rule}>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              {/* Ticked is allowed. The column stores refusals, but an
                  operator reads a list of permissions, not of prohibitions. */}
              <input
                type="checkbox"
                checked={!denied.includes(rule.rule)}
                disabled={pending}
                onChange={() => toggle(rule.rule)}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              <span>{rule.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MethodsCard({
  userId,
  methods,
  restricted,
  pending,
  run,
  labels,
}: {
  userId: string;
  methods: MethodRow[];
  restricted: boolean;
  pending: boolean;
  run: Runner;
  labels: Record<string, string>;
}) {
  const [limited, setLimited] = useState(restricted);
  const [allowed, setAllowed] = useState<string[]>(methods.filter((m) => m.allowed).map((m) => m.id));

  const save = (ids: string[]) => run(() => setUserPaymentMethodsAction(userId, ids));

  const toggle = (id: string) => {
    const next = allowed.includes(id) ? allowed.filter((x) => x !== id) : [...allowed, id];
    setAllowed(next);
    save(next);
  };

  return (
    <section className="card space-y-3 p-5">
      <div>
        <h3 className="font-semibold">{labels.methods}</h3>
        <p className="muted text-sm">{labels.methodsHint}</p>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={!limited}
          disabled={pending}
          onChange={(e) => {
            const all = e.target.checked;
            setLimited(!all);
            // Lifting the restriction is an empty list, which is what every
            // account carries until one is restricted.
            if (all) save([]);
            else save(allowed);
          }}
          className="h-4 w-4 accent-[var(--primary)]"
        />
        <span>{labels.allMethods}</span>
      </label>

      {limited && (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {methods.map((method) => (
            <li key={method.id}>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={allowed.includes(method.id)}
                  disabled={pending}
                  onChange={() => toggle(method.id)}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                <span>{method.name}</span>
                {!method.enabled && <span className="badge badge-muted">{labels.disabled}</span>}
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RateCard({
  userId,
  services,
  pending,
  run,
  labels,
}: {
  userId: string;
  services: RateRow[];
  pending: boolean;
  run: Runner;
  labels: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(services.map((s) => [s.id, s.override])),
  );
  const [copyTo, setCopyTo] = useState("");

  const overrides = useMemo(() => services.filter((s) => s.override !== "").length, [services]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(needle) ||
        s.category.toLowerCase().includes(needle) ||
        String(s.publicId) === needle,
    );
  }, [services, query]);

  const save = (serviceId: string) => {
    const typed = (drafts[serviceId] ?? "").trim();
    run(() => setUserRateAction(userId, serviceId, typed === "" ? null : Number(typed)));
  };

  return (
    <section className="card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{labels.rateCard}</h3>
          <p className="muted text-sm">{labels.rateCardHint}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge badge-muted">{labels.overrideCount.replace("{n}", String(overrides))}</span>
          <button
            type="button"
            disabled={pending || overrides === 0}
            onClick={() => {
              if (confirm(labels.confirmReset)) run(() => resetUserRatesAction([userId]));
            }}
            className="btn btn-ghost btn-sm"
          >
            <Icon name="refresh" size={14} />
            {labels.resetRates}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="min-w-56 flex-1">
          <label htmlFor="copyTo" className="label">
            {labels.copyTo}
          </label>
          <input
            id="copyTo"
            value={copyTo}
            onChange={(e) => setCopyTo(e.target.value)}
            placeholder="reseller1, reseller2"
            className="field"
          />
          <p className="form-hint">{labels.copyHint}</p>
        </div>
        <button
          type="button"
          disabled={pending || copyTo.trim() === ""}
          onClick={() => run(() => copyUserRatesAction(userId, copyTo.split(",")))}
          className="btn btn-ghost mt-6"
        >
          <Icon name="copy" size={15} />
          {labels.copy}
        </button>
      </div>

      <div className="relative">
        <span className="muted pointer-events-none absolute top-1/2 start-3.5 -translate-y-1/2">
          <Icon name="search" size={16} />
        </span>
        <label htmlFor="rateSearch" className="sr-only">
          {labels.search}
        </label>
        <input
          id="rateSearch"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.search}
          className="field ps-11"
        />
      </div>

      <div className="scroll-x">
        <table className="table">
          <thead>
            <tr>
              <th className="w-16">ID</th>
              <th>{labels.service}</th>
              <th className="w-28 text-end">{labels.list}</th>
              <th className="w-28 text-end">{labels.tierPrice}</th>
              <th className="w-28 text-end">{labels.effective}</th>
              <th className="w-52">{labels.override}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((service) => (
              <tr key={service.id}>
                <td className="muted font-mono text-xs">{service.publicId}</td>
                <td>
                  <span className="font-medium">{service.name}</span>
                  <span className="muted mt-0.5 block truncate text-xs">{service.category}</span>
                </td>
                <td className="muted text-end tabular-nums">{service.list}</td>
                <td className="muted text-end tabular-nums">{service.tier}</td>
                <td className="text-end font-semibold tabular-nums">{service.effective}</td>
                <td>
                  <div className="flex gap-1">
                    <label htmlFor={`rate-${service.id}`} className="sr-only">
                      {labels.override}
                    </label>
                    <input
                      id={`rate-${service.id}`}
                      type="number"
                      min={0}
                      step="any"
                      value={drafts[service.id] ?? ""}
                      onChange={(e) => setDrafts({ ...drafts, [service.id]: e.target.value })}
                      onBlur={() => {
                        if ((drafts[service.id] ?? "") !== service.override) save(service.id);
                      }}
                      className="field py-1.5 text-xs"
                    />
                    {service.override !== "" && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setDrafts({ ...drafts, [service.id]: "" });
                          run(() => setUserRateAction(userId, service.id, null));
                        }}
                        className="btn btn-ghost btn-sm"
                        title={labels.clear}
                      >
                        <Icon name="close" size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
