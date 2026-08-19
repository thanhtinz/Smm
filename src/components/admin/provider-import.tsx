"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  importSelectedServicesAction,
  loadProviderCatalogueAction,
  type CatalogueRow,
} from "@/app/actions/admin/provider-import";
import type { CatalogueCategory } from "@/lib/provider-catalogue";
import { Icon } from "@/components/icons";

/**
 * Picking what to stock, rather than taking everything.
 *
 * The order of the steps is the order the decisions actually depend on each
 * other: which supplier, which of their categories, then where it lands here —
 * platform, then category — and only then the services themselves. Each step
 * stays on screen after it is answered, because an operator importing forty
 * services in six passes is re-reading their own choices constantly.
 */

export type PlatformOption = { id: string; name: string; categories: { id: string; name: string }[] };
export type ProviderOption = { id: string; name: string; markupPercent: number };

export default function ProviderImport({
  providers,
  platforms,
  preselectedProviderId,
  labels,
}: {
  providers: ProviderOption[];
  platforms: PlatformOption[];
  preselectedProviderId: string;
  labels: Record<string, string>;
}) {
  const [providerId, setProviderId] = useState(preselectedProviderId);
  const [catalogue, setCatalogue] = useState<CatalogueRow[]>([]);
  const [categories, setCategories] = useState<CatalogueCategory[]>([]);
  const [theirCategory, setTheirCategory] = useState("");
  const [platformId, setPlatformId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, start] = useTransition();

  const provider = providers.find((p) => p.id === providerId);
  const platform = platforms.find((p) => p.id === platformId);

  const load = () => {
    if (!providerId) return;
    setError("");
    setNotice("");
    setCatalogue([]);
    setCategories([]);
    setTheirCategory("");
    setPicked([]);
    start(async () => {
      const result = await loadProviderCatalogueAction(providerId);
      if (result.error) return setError(result.error);
      setCategories(result.categories ?? []);
      setCatalogue(result.services ?? []);
    });
  };

  const shownCategories = useMemo(() => {
    const q = categoryQuery.trim().toLowerCase();
    return q ? categories.filter((c) => c.name.toLowerCase().includes(q)) : categories;
  }, [categories, categoryQuery]);

  // What the checkboxes act on. Select-all is computed from this same list, so
  // ticking everything means everything the operator can currently see — never
  // a row the search has hidden.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalogue.filter((row) => {
      if (row.category !== theirCategory) return false;
      if (q && !`${row.providerServiceId} ${row.name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [catalogue, theirCategory, query]);

  const selectable = shown.filter((row) => !row.imported);
  const allPicked = selectable.length > 0 && selectable.every((row) => picked.includes(row.providerServiceId));

  const submit = () => {
    if (!categoryId || picked.length === 0) return;
    setError("");
    setNotice("");
    start(async () => {
      const result = await importSelectedServicesAction(providerId, categoryId, picked);
      if (result.error) return setError(result.error);
      setNotice(
        labels.done
          .replace("{created}", String(result.created ?? 0))
          .replace("{skipped}", String(result.skipped ?? 0)),
      );
      // The rows that landed are now stocked, so they stop being selectable
      // without another read of their whole catalogue.
      const taken = new Set(picked);
      setCatalogue((rows) => rows.map((row) => (taken.has(row.providerServiceId) ? { ...row, imported: true } : row)));
      setPicked([]);
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{labels.title}</h2>
        <Link href="/admin/providers" className="btn btn-ghost btn-sm">
          <Icon name="arrowLeft" size={15} />
          {labels.back}
        </Link>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="alert alert-success" role="status">
          <Icon name="checkCircle" size={16} />
          <span>{notice}</span>
        </div>
      )}

      <Step index={1} title={labels.stepProvider}>
        <div className="flex flex-wrap gap-2">
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            className="field w-auto min-w-56 flex-1"
            aria-label={labels.stepProvider}
          >
            <option value="">{labels.choose}</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={load} disabled={!providerId || pending} className="btn btn-primary">
            <Icon name="download" size={15} />
            {pending && catalogue.length === 0 ? labels.loading : labels.load}
          </button>
        </div>
        {provider && catalogue.length > 0 && (
          <p className="muted mt-2 text-sm">
            {labels.markupNote.replace("{markup}", String(provider.markupPercent))}
          </p>
        )}
      </Step>

      {categories.length > 0 && (
        <Step index={2} title={labels.stepTheirCategory}>
          <label className="sr-only" htmlFor="import-category-filter">
            {labels.filterCategories}
          </label>
          <input
            id="import-category-filter"
            value={categoryQuery}
            onChange={(e) => setCategoryQuery(e.target.value)}
            placeholder={labels.filterCategories}
            className="field mb-3"
          />
          <div className="max-h-72 space-y-1 overflow-y-auto pe-1">
            {shownCategories.map((category) => (
              <button
                key={category.name}
                type="button"
                onClick={() => {
                  setTheirCategory(category.name);
                  setQuery("");
                  setPicked([]);
                }}
                aria-pressed={theirCategory === category.name}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start text-sm ${
                  theirCategory === category.name ? "bg-[var(--primary)] text-white" : "hover:bg-[var(--surface2)]"
                }`}
              >
                <span className="truncate">{category.name}</span>
                <span className="shrink-0 tabular-nums opacity-70">{category.count}</span>
              </button>
            ))}
            {shownCategories.length === 0 && <p className="muted px-3 py-6 text-center text-sm">{labels.noServices}</p>}
          </div>
        </Step>
      )}

      {theirCategory && (
        <Step index={3} title={labels.stepDestination}>
          {platforms.length === 0 ? (
            <p className="muted text-sm">{labels.noPlatforms}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="import-platform" className="mb-1.5 block text-sm font-medium">
                  {labels.stepOurPlatform}
                </label>
                <select
                  id="import-platform"
                  value={platformId}
                  onChange={(e) => {
                    setPlatformId(e.target.value);
                    setCategoryId("");
                  }}
                  className="field"
                >
                  <option value="">{labels.choose}</option>
                  {platforms.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="import-category" className="mb-1.5 block text-sm font-medium">
                  {labels.stepOurCategory}
                </label>
                <select
                  id="import-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={!platform}
                  className="field"
                >
                  <option value="">
                    {platform && platform.categories.length === 0 ? labels.noCategories : labels.choose}
                  </option>
                  {platform?.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </Step>
      )}

      {theirCategory && categoryId && (
        <Step index={4} title={labels.stepServices}>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="relative min-w-56 flex-1">
              <span className="muted pointer-events-none absolute inset-y-0 start-0 flex items-center ps-4">
                <Icon name="search" size={15} />
              </span>
              <label className="sr-only" htmlFor="import-search">
                {labels.searchServices}
              </label>
              <input
                id="import-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={labels.searchServices}
                className="field ps-11"
              />
            </div>
            <span className="muted text-sm tabular-nums">{labels.picked.replace("{count}", String(picked.length))}</span>
          </div>

          <div className="card max-h-[28rem] overflow-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10">
                    <label className="sr-only" htmlFor="import-pick-all">
                      {labels.selectAll}
                    </label>
                    <input
                      id="import-pick-all"
                      type="checkbox"
                      checked={allPicked}
                      disabled={selectable.length === 0}
                      onChange={() =>
                        setPicked(allPicked ? [] : selectable.map((row) => row.providerServiceId))
                      }
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                  </th>
                  <th>{labels.service}</th>
                  <th className="w-28 text-end">{labels.cost}</th>
                  <th className="w-28 text-end">{labels.sell}</th>
                  <th className="w-32 text-end">{labels.quantity}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.providerServiceId}>
                    <td>
                      <label className="sr-only" htmlFor={`pick-${row.providerServiceId}`}>
                        {row.name}
                      </label>
                      <input
                        id={`pick-${row.providerServiceId}`}
                        type="checkbox"
                        checked={picked.includes(row.providerServiceId)}
                        disabled={row.imported}
                        onChange={() =>
                          setPicked(
                            picked.includes(row.providerServiceId)
                              ? picked.filter((x) => x !== row.providerServiceId)
                              : [...picked, row.providerServiceId],
                          )
                        }
                        className="h-4 w-4 accent-[var(--primary)]"
                      />
                    </td>
                    <td>
                      <span className="font-medium">{row.name}</span>
                      <span className="muted ms-2 font-mono text-xs">{row.providerServiceId}</span>
                      {row.imported && (
                        <span className="badge badge-muted ms-2">
                          <Icon name="check" size={11} />
                          {labels.already}
                        </span>
                      )}
                    </td>
                    <td className="text-end tabular-nums">{row.rate}</td>
                    <td className="text-end tabular-nums">{row.sell}</td>
                    <td className="muted text-end tabular-nums">
                      {row.min} – {row.max}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length === 0 && <p className="muted px-5 py-10 text-center text-sm">{labels.noServices}</p>}
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={pending || picked.length === 0}
            className="btn btn-primary mt-4"
          >
            <Icon name="download" size={16} />
            {labels.submit.replace("{count}", String(picked.length))}
          </button>
        </Step>
      )}
    </>
  );
}

function Step({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card card-pad">
      <h3 className="mb-3 flex items-center gap-2.5 font-semibold">
        <span className="surface-2 flex h-7 w-7 items-center justify-center rounded-full text-xs tabular-nums">
          {index}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}
