"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { deleteServiceAction, saveServiceAction, toggleServiceAction, type ActionResult } from "@/app/actions/admin/catalogue";
import { Field, TextInput } from "@/components/ui/field";
import SubmitButton from "@/components/ui/submit-button";
import EntityDrawer from "@/components/admin/entity-drawer";
import { Icon } from "@/components/icons";
import RouteEditor, { type RouteRow } from "@/components/admin/route-editor";
import PlatformMark from "@/components/platform-mark";

export type ServiceRow = {
  id: string;
  publicId: number;
  name: string;
  description: string;
  categoryId: string;
  providerId: string | null;
  providerServiceId: string;
  /** Where an order goes when the provider above refuses it. */
  backupProviderId: string | null;
  backupProviderServiceId: string;
  /** Set on a child panel: the parent's service this one is bought from. */
  sourceServiceId: string;
  /** What the parent charges for it — the cost side of the margin. */
  sourceCost: number;
  /** Hand-set price per tier id, empty where the tier percentage applies. */
  tierPrices: Record<string, string>;
  /** Set when the sell price follows the provider's cost plus its markup. */
  autoPrice: boolean;
  type: string;
  target: string;
  routes: RouteRow[];
  rate: number;
  providerRate: number;
  min: number;
  max: number;
  refill: boolean;
  cancel: boolean;
  dripfeed: boolean;
  averageTime: string;
  tags: string;
  warrantyDays: number;
  startMinutes: number;
  speedPerDay: number;
  enabled: boolean;
  position: number;
};

export type CategoryOption = { id: string; name: string; platformId: string | null };
export type PlatformOption = { id: string; name: string; icon: string; image: string; color: string };
export type ProviderOption = { id: string; name: string };
/** A service on the parent panel, with what this panel would pay for it. */
export type SourceOption = { id: string; name: string; cost: string };

/** A tier this panel sells to. Hand-set prices live on the service row. */
export type TierPriceOption = { id: string; name: string; color: string; discountPercent: number };

export default function ServiceManager({
  rows,
  categories,
  platforms,
  providers,
  sourceServices,
  tiers,
  isChild,
  currency,
  labels,
  routeLabels,
}: {
  rows: ServiceRow[];
  categories: CategoryOption[];
  platforms: PlatformOption[];
  providers: ProviderOption[];
  sourceServices: SourceOption[];
  tiers: TierPriceOption[];
  isChild: boolean;
  currency: { symbol: string; symbolBefore: boolean; decimals: number; rate: number; locale: string };
  labels: Record<string, string>;
  /** The supplier list has its own words: several names collide. */
  routeLabels: Record<string, string>;
}) {
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [query, setQuery] = useState("");
  const [pending, start] = useTransition();

  const close = () => {
    setEditing(null);
    setCreating(false);
  };

  const fmt = (base: number) => {
    const text = new Intl.NumberFormat(currency.locale === "vi" ? "vi-VN" : currency.locale, {
      minimumFractionDigits: currency.decimals,
      maximumFractionDigits: currency.decimals,
    }).format(base * currency.rate);
    return currency.symbolBefore ? `${currency.symbol}${text}` : `${text}${currency.symbol}`;
  };

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const platformById = useMemo(() => new Map(platforms.map((p) => [p.id, p])), [platforms]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (platformFilter) {
        const category = categoryById.get(r.categoryId);
        if (category?.platformId !== platformFilter) return false;
      }
      if (q && !`${r.publicId} ${r.name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, platformFilter, query, categoryById]);

  const remove = (row: ServiceRow) => {
    if (!confirm(labels.confirmDelete)) return;
    setError("");
    start(async () => {
      const result = await deleteServiceAction(row.id);
      if (result.error) setError(result.error);
    });
  };

  const toggle = (row: ServiceRow) => {
    start(async () => {
      await toggleServiceAction(row.id, !row.enabled);
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{labels.title}</h2>
        <button
          type="button"
          onClick={() => setCreating(true)}
          disabled={categories.length === 0}
          className="btn btn-primary btn-sm"
        >
          <Icon name="plus" size={15} />
          {labels.new}
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      {categories.length === 0 && (
        <div className="alert alert-info" role="status">
          <Icon name="info" size={16} />
          <span>{labels.needCategory}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <span className="muted pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2">
            <Icon name="search" size={16} />
          </span>
          <label htmlFor="service-filter" className="sr-only">
            {labels.search}
          </label>
          <input
            id="service-filter"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={labels.search}
            className="field pl-11"
          />
        </div>
        <label htmlFor="service-platform" className="sr-only">
          {labels.filter}
        </label>
        <select
          id="service-platform"
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="field w-auto"
        >
          <option value="">{labels.allPlatforms}</option>
          {platforms.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <p className="muted text-sm" aria-live="polite">
        {visible.length} {labels.count}
      </p>

      <div className="card overflow-hidden">
        {visible.length === 0 ? (
          <p className="muted px-5 py-14 text-center text-sm">{labels.empty}</p>
        ) : (
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-16">ID</th>
                  <th>{labels.name}</th>
                  <th className="w-32 text-right">{labels.rate}</th>
                  <th className="w-32 text-right">{labels.margin}</th>
                  <th className="w-32 text-right">{labels.limits}</th>
                  <th className="w-28">{labels.status}</th>
                  <th className="w-24 text-right">{labels.actions}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const category = categoryById.get(row.categoryId);
                  const platform = category ? platformById.get(category.platformId ?? "") : undefined;
                  // A child panel's cost is what its parent charges; the root
                  // panel's is what its outside provider charges.
                  const cost = row.sourceCost > 0 ? row.sourceCost : row.providerRate;
                  const margin = cost > 0 && row.rate > 0 ? ((row.rate - cost) / row.rate) * 100 : null;
                  return (
                    <tr key={row.id}>
                      <td className="muted font-mono text-xs">{row.publicId}</td>
                      <td>
                        <span className="flex items-center gap-2 font-medium">
                          {platform && <PlatformMark platform={platform} size={15} />}
                          <span className="truncate">{row.name}</span>
                        </span>
                        <span className="muted mt-0.5 block text-xs">{category?.name}</span>
                      </td>
                      <td className="text-right font-semibold tabular-nums">{fmt(row.rate)}</td>
                      <td className="text-right tabular-nums">
                        {margin === null ? <span className="muted">—</span> : `${margin.toFixed(0)}%`}
                      </td>
                      <td className="muted text-right text-xs tabular-nums">
                        {row.min.toLocaleString()}–{row.max.toLocaleString()}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => toggle(row)}
                          disabled={pending}
                          className={`badge ${row.enabled ? "badge-success" : "badge-muted"}`}
                          aria-label={`${row.enabled ? labels.disabled : labels.enabled} ${row.name}`}
                        >
                          <Icon name={row.enabled ? "check" : "close"} size={11} />
                          {row.enabled ? labels.enabled : labels.disabled}
                        </button>
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditing(row)}
                            className="btn btn-ghost btn-sm"
                            aria-label={`${labels.edit} ${row.name}`}
                          >
                            <Icon name="edit" size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(row)}
                            disabled={pending}
                            className="btn btn-danger btn-sm"
                            aria-label={`${labels.delete} ${row.name}`}
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EntityDrawer
        closeLabel={labels.close}
        open={creating || editing !== null}
        title={editing ? `${labels.edit} — ${editing.name}` : labels.new}
        onClose={close}
      >
        <ServiceForm
          key={editing?.id ?? "new"}
          row={editing}
          categories={categories}
          platforms={platforms}
          providers={providers}
          sourceServices={sourceServices}
          tiers={tiers}
          isChild={isChild}
          labels={labels}
          routeLabels={routeLabels}
          onDone={close}
        />
      </EntityDrawer>
    </>
  );
}

function ServiceForm({
  row,
  categories,
  platforms,
  providers,
  sourceServices,
  tiers,
  isChild,
  labels,
  routeLabels,
  onDone,
}: {
  row: ServiceRow | null;
  categories: CategoryOption[];
  platforms: PlatformOption[];
  providers: ProviderOption[];
  sourceServices: SourceOption[];
  tiers: TierPriceOption[];
  isChild: boolean;
  labels: Record<string, string>;
  /** The supplier list has its own words: several names collide. */
  routeLabels: Record<string, string>;
  onDone: () => void;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(async (prev, form) => {
    const result = await saveServiceAction(prev, form);
    if (result.ok) onDone();
    return result;
  }, {});

  // Tracked so the per-tier placeholders follow the price as it is typed.
  const [rate, setRate] = useState(String(row?.rate ?? ""));

  const grouped = useMemo(() => {
    const map = new Map<string, CategoryOption[]>();
    for (const c of categories) {
      const key = platforms.find((p) => p.id === c.platformId)?.name ?? "—";
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return [...map.entries()];
  }, [categories, platforms]);

  return (
    <>
    <form action={action} className="space-y-4" noValidate>
      {row && <input type="hidden" name="id" value={row.id} />}

      {state.error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{state.error}</span>
        </div>
      )}

      <Field name="categoryId" label={labels.category} error={state.fieldErrors?.categoryId} required>
        <select id="categoryId" name="categoryId" className="field" defaultValue={row?.categoryId ?? categories[0]?.id}>
          {grouped.map(([platform, list]) => (
            <optgroup key={platform} label={platform}>
              {list.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      <Field name="name" label={labels.name} error={state.fieldErrors?.name} required>
        <TextInput name="name" defaultValue={row?.name} error={state.fieldErrors?.name} />
      </Field>


      <Field name="description" label={labels.description}>
        <textarea id="description" name="description" rows={3} className="field" defaultValue={row?.description} />
      </Field>

      {/* The type decides what the order form asks for: a quantity, or the
          comments themselves with the quantity coming from the line count. */}
      <Field name="type" label={labels.type}>
        <select id="type" name="type" className="field" defaultValue={row?.type ?? "default"}>
          <option value="default">{labels.typeDefault}</option>
          <option value="custom_comments">{labels.typeCustomComments}</option>
          <option value="subscription">{labels.typeSubscription}</option>
        </select>
      </Field>

      {/* Which of the platform's two shapes this service's link must be. A
          subscription is addressed by username, so it has no say here. */}
      <Field name="target" label={labels.target} hint={labels.targetHint}>
        <select id="target" name="target" className="field" defaultValue={row?.target ?? "post"}>
          <option value="post">{labels.targetPost}</option>
          <option value="profile">{labels.targetProfile}</option>
        </select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="rate" label={labels.rate} error={state.fieldErrors?.rate} required>
          <TextInput
            name="rate"
            type="number"
            step="any"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            error={state.fieldErrors?.rate}
          />
        </Field>
        <Field name="providerRate" label={labels.providerRate}>
          <TextInput name="providerRate" type="number" step="any" defaultValue={String(row?.providerRate ?? 0)} />
        </Field>
        <Field name="min" label={labels.min} error={state.fieldErrors?.min} required>
          <TextInput name="min" type="number" defaultValue={String(row?.min ?? 100)} error={state.fieldErrors?.min} />
        </Field>
        <Field name="max" label={labels.max} error={state.fieldErrors?.max} required>
          <TextInput name="max" type="number" defaultValue={String(row?.max ?? 10000)} error={state.fieldErrors?.max} />
        </Field>
        <Field name="averageTime" label={labels.averageTime}>
          <TextInput name="averageTime" defaultValue={row?.averageTime} placeholder="1 hour" />
        </Field>

        {/* What the customer scans before reading anything. The words are the
            operator's — this panel does not know a vocabulary — and a label
            may name its colour after a colon. */}
        <Field name="tags" label={labels.tags} hint={labels.tagsHint}>
          <TextInput
            name="tags"
            defaultValue={row?.tags}
            hint={labels.tagsHint}
            placeholder="Hot:danger, Giá rẻ:success, Ít tụt"
          />
        </Field>

        {/* The three numbers this market quotes. Left at zero each one shows
            nothing rather than "0", because a service nobody has bought yet
            promising "0 minutes" is a lie in the other direction. */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field name="startMinutes" label={labels.startMinutes} hint={labels.promiseHint}>
            <TextInput
              name="startMinutes"
              type="number"
              min={0}
              defaultValue={String(row?.startMinutes ?? 0)}
              hint={labels.promiseHint}
            />
          </Field>
          <Field name="speedPerDay" label={labels.speedPerDay} hint={labels.promiseHint}>
            <TextInput
              name="speedPerDay"
              type="number"
              min={0}
              defaultValue={String(row?.speedPerDay ?? 0)}
              hint={labels.promiseHint}
            />
          </Field>
          <Field name="warrantyDays" label={labels.warrantyDays} hint={labels.promiseHint}>
            <TextInput
              name="warrantyDays"
              type="number"
              min={0}
              defaultValue={String(row?.warrantyDays ?? 0)}
              hint={labels.promiseHint}
            />
          </Field>
        </div>
        <Field name="position" label={labels.position}>
          <TextInput name="position" type="number" defaultValue={String(row?.position ?? 0)} />
        </Field>
      </div>

      {isChild ? (
        <Field
          name="sourceServiceId"
          label={labels.sourceService}
          error={state.fieldErrors?.sourceServiceId}
          hint={labels.sourceHint}
        >
          <select
            id="sourceServiceId"
            name="sourceServiceId"
            className="field"
            defaultValue={row?.sourceServiceId ?? ""}
          >
            <option value="">{labels.noSource}</option>
            {sourceServices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.cost}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <>
          <Field name="providerId" label={labels.provider}>
            <select id="providerId" name="providerId" className="field" defaultValue={row?.providerId ?? ""}>
              <option value="">{labels.noProvider}</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>

          <Field name="providerServiceId" label={labels.providerServiceId}>
            <TextInput name="providerServiceId" defaultValue={row?.providerServiceId} />
          </Field>

          {/* Tried only when the one above refuses, so an outage upstream
              does not become a queue of orders nobody looks at. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="backupProviderId" label={labels.backupProvider} hint={labels.backupHint}>
              <select
                id="backupProviderId"
                name="backupProviderId"
                className="field"
                defaultValue={row?.backupProviderId ?? ""}
              >
                <option value="">{labels.noProvider}</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field name="backupProviderServiceId" label={labels.backupServiceId}>
              <TextInput name="backupProviderServiceId" defaultValue={row?.backupProviderServiceId} />
            </Field>
          </div>
        </>
      )}

      {/* Sits with the price because it decides who owns it: ticked, the
          provider sync writes it; cleared, this field is the last word. */}
      <Check name="autoPrice" label={labels.autoPrice} defaultChecked={row?.autoPrice ?? false} />

      {tiers.length > 0 && (
        <TierPrices
          tiers={tiers}
          manual={row?.tierPrices ?? {}}
          rate={Number(rate) || 0}
          labels={labels}
          errors={state.fieldErrors}
        />
      )}

      <div>
        <span className="label">{labels.flags}</span>
        <div className="grid gap-2 sm:grid-cols-2">
          <Check name="refill" label={labels.refill} defaultChecked={row?.refill ?? false} />
          <Check name="cancel" label={labels.cancelOption} defaultChecked={row?.cancel ?? true} />
          <Check name="dripfeed" label={labels.dripfeed} defaultChecked={row?.dripfeed ?? false} />
          <Check name="enabled" label={labels.enabled} defaultChecked={row?.enabled ?? true} />
        </div>
      </div>



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

    {/* Outside the form on purpose: each supplier saves on its own, and a
        service has to exist before anything can be routed to it. */}
    {row && (
      <RouteEditor serviceId={row.id} rows={row.routes} providers={providers} labels={routeLabels} />
    )}
    </>
  );
}

/**
 * Per-tier prices, edited next to the price they override.
 *
 * Each row shows what the tier percentage would give, so it is obvious when a
 * hand-set price is worth having and what it is replacing. Blank means the
 * percentage applies.
 */
function TierPrices({
  tiers,
  manual,
  rate,
  labels,
  errors,
}: {
  tiers: TierPriceOption[];
  manual: Record<string, string>;
  rate: number;
  labels: Record<string, string>;
  errors?: Record<string, string>;
}) {
  return (
    <div>
      <span className="label">{labels.tierPrices}</span>
      <div className="space-y-2">
        {tiers.map((tier) => {
          const discounted = rate * (1 - Math.min(100, tier.discountPercent) / 100);
          const field = `tierPrice:${tier.id}`;
          return (
            <div key={tier.id} className="flex items-center gap-2.5">
              <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tier.color }} />
                <span className="truncate">{tier.name}</span>
                {tier.discountPercent > 0 && <span className="muted shrink-0 text-xs">-{tier.discountPercent}%</span>}
              </span>
              <label htmlFor={field} className="sr-only">
                {`${labels.manualPrice} — ${tier.name}`}
              </label>
              <input
                id={field}
                name={field}
                type="number"
                step="any"
                min="0"
                defaultValue={manual[tier.id] ?? ""}
                placeholder={Number.isFinite(discounted) ? String(Math.round(discounted)) : ""}
                className={`field w-40 tabular-nums ${errors?.[field] ? "field-error" : ""}`}
              />
            </div>
          );
        })}
      </div>
      <p className="form-hint">{labels.tierPricesHint}</p>
    </div>
  );
}

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="surface-2 flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-[var(--primary)]" />
      {label}
    </label>
  );
}
