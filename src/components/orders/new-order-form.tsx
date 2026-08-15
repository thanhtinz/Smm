"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { placeOrderAction, type OrderState } from "@/app/actions/orders";
import { Field, TextInput } from "@/components/ui/field";
import Combobox from "@/components/ui/combobox";
import SubmitButton from "@/components/ui/submit-button";
import { Icon, type IconName } from "@/components/icons";
import OrderFacts, { type Fact } from "@/components/orders/order-facts";
import ServiceSearch from "@/components/orders/service-search";
import PlatformMark from "@/components/platform-mark";
import { SUBSCRIPTION_DELAYS } from "@/lib/orders";

export type ServiceOption = {
  id: string;
  publicId: number;
  name: string;
  categoryId: string;
  /** What this customer pays, after their tier discount. */
  rate: number;
  /** The list price, so a discount can be shown as a saving. */
  listRate: number;
  min: number;
  max: number;
  refill: boolean;
  cancel: boolean;
  dripfeed: boolean;
  type: string;
  /** The shape this service's link should have, shown as the placeholder. */
  linkExample: string;
  averageTime: string;
  description: string;
};

/**
 * A repeat of an earlier order, read off the URL by the page.
 *
 * Every field is optional and every one is only a starting value: the customer
 * lands on a filled form they can change, not a confirmation they have to
 * undo. The service is resolved to an id server-side, so a number that no
 * longer sells arrives as an empty string and the cascade opens as normal.
 */
export type Prefill = {
  serviceId: string;
  link: string;
  quantity: string;
  comments: string;
  username: string;
  posts: string;
  minPerPost: string;
  maxPerPost: string;
  delay: string;
  expiry: string;
  runs: string;
  interval: string;
};

export type CategoryOption = { id: string; name: string; platformId: string | null };
export type PlatformOption = { id: string; name: string; icon: string; image: string; color: string };

export type OrderLabels = Record<
  | "platform"
  | "category"
  | "service"
  | "link"
  | "quantity"
  | "charge"
  | "submit"
  | "min"
  | "max"
  | "rate"
  | "balance"
  | "addFunds"
  | "selectCategory"
  | "selectService"
  | "id"
  | "limits"
  | "selectPlatform"
  | "quickFind"
  | "quickFindHint"
  | "quickFindPlaceholder"
  | "factTime"
  | "factUnknown"
  | "factCancel"
  | "factWarranty"
  | "factYes"
  | "factNo"
  | "listPrice"
  | "selectPlatformFirst"
  | "selectCategoryFirst"
  | "searchService"
  | "noResults"
  | "averageTime"
  | "refillLabel"
  | "cancelLabel"
  | "yes"
  | "no"
  | "placed"
  | "track"
  | "insufficient"
  | "dripfeed"
  | "comments"
  | "commentsHint"
  | "username"
  | "usernameHint"
  | "posts"
  | "postsHint"
  | "perPost"
  | "delay"
  | "delayHint"
  | "expiry"
  | "expiryHint"
  | "minutes"
  | "runs"
  | "interval"
  | "intervalHint"
  | "total",
  string
>;

export type Currency = {
  code: string;
  symbol: string;
  symbolBefore: boolean;
  decimals: number;
  rate: number;
  locale: string;
};

export function formatCurrency(base: number, currency: Currency) {
  const value = new Intl.NumberFormat(currency.locale === "vi" ? "vi-VN" : currency.locale, {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  }).format(base * currency.rate);
  return currency.symbolBefore ? `${currency.symbol}${value}` : `${value}${currency.symbol}`;
}

export default function NewOrderForm({
  platforms,
  categories,
  services,
  balance,
  currency,
  accountCard,
  prefill,
  labels,
}: {
  platforms: PlatformOption[];
  categories: CategoryOption[];
  services: ServiceOption[];
  balance: number;
  currency: Currency;
  /** Rendered on the server: it formats money and reads the customer tier. */
  accountCard?: React.ReactNode;
  /** Starting values from a "order this again" link. */
  prefill?: Prefill;
  labels: OrderLabels;
}) {
  const [state, action] = useActionState<OrderState, FormData>(placeOrderAction, {});

  // A repeat arrives with the service already chosen, so the two steps above
  // it are filled in from the catalogue rather than asked again.
  const repeat = prefill?.serviceId ? services.find((s) => s.id === prefill.serviceId) : undefined;
  const repeatCategory = repeat ? categories.find((c) => c.id === repeat.categoryId) : undefined;

  // Strictly cascading: nothing is preselected, and each step only unlocks
  // once the step above it has been answered.
  const [platformId, setPlatformId] = useState(repeatCategory?.platformId ?? "");
  const [categoryId, setCategoryId] = useState(repeat?.categoryId ?? "");
  const [serviceId, setServiceId] = useState(repeat?.id ?? "");

  const visibleCategories = useMemo(
    () => (platformId ? categories.filter((c) => c.platformId === platformId) : []),
    [categories, platformId]
  );
  const visibleServices = useMemo(
    () => (categoryId ? services.filter((s) => s.categoryId === categoryId) : []),
    [services, categoryId]
  );
  const service = visibleServices.find((s) => s.id === serviceId);

  const [quantity, setQuantity] = useState(prefill?.quantity ?? "");
  const [comments, setComments] = useState(prefill?.comments ?? "");

  // These services are bought by the comment, not by the thousand, so the
  // quantity is however many lines the customer wrote.
  const custom = service?.type === "custom_comments";
  const commentLines = comments.split("\n").map((l) => l.trim()).filter(Boolean).length;
  const [dripfeed, setDripfeed] = useState(Boolean(prefill?.runs));
  const [runs, setRuns] = useState(prefill?.runs ?? "");
  const [interval, setInterval] = useState(prefill?.interval ?? "");

  // A subscription watches a profile and delivers on each new post, so what is
  // charged is the ceiling it could reach: posts x the most per post.
  const subscription = service?.type === "subscription";
  const [username, setUsername] = useState(prefill?.username ?? "");
  const [posts, setPosts] = useState(prefill?.posts ?? "");
  const [minPerPost, setMinPerPost] = useState(prefill?.minPerPost ?? "");
  const [maxPerPost, setMaxPerPost] = useState(prefill?.maxPerPost ?? "");
  const [delay, setDelay] = useState(prefill?.delay || "0");
  const [expiry, setExpiry] = useState(prefill?.expiry ?? "");

  const qty = subscription
    ? Number(posts) * Number(maxPerPost)
    : custom
      ? commentLines
      : Number(quantity);
  const runsNum = Number(runs);
  const units = dripfeed && runsNum > 1 ? qty * runsNum : qty;
  const charge = service && Number.isFinite(units) && units > 0 ? Math.round((service.rate * units) / 1000) : 0;
  const affordable = charge <= balance;
  const outOfRange =
    service && !subscription && qty > 0 && (qty < service.min || qty > service.max);
  const fmt = (base: number) => formatCurrency(base, currency);

  /**
   * Everything, searchable, for customers who already know what they want.
   *
   * The cascade is right for browsing and wrong for the buyer who orders the
   * same thing every week: three selects to reach a service they can name.
   * Picking here fills the cascade in behind them.
   */
  const everything = useMemo(
    () =>
      services.map((service) => {
        const category = categories.find((c) => c.id === service.categoryId);
        return { service, category, platformId: category?.platformId ?? "" };
      }),
    [services, categories],
  );

  const jumpTo = (id: string) => {
    const hit = everything.find((row) => row.service.id === id);
    if (!hit) return;
    setPlatformId(hit.platformId);
    setCategoryId(hit.service.categoryId);
    setServiceId(id);
  };

  // No "Status: on sale" tile: a service that is not on sale never reaches
  // this list, so that tile was a tick that could never say anything else and
  // it cost a quarter of the row.
  const facts: Fact[] = service
    ? [
        {
          key: "time",
          label: labels.factTime,
          // Free text from the provider, so it is shown as written rather than
          // parsed into a number this panel cannot vouch for.
          value: service.averageTime || labels.factUnknown,
          tone: service.averageTime ? "neutral" : "neutral",
          icon: "clock",
        },
        {
          key: "cancel",
          label: labels.factCancel,
          value: service.cancel ? labels.factYes : labels.factNo,
          tone: service.cancel ? "good" : "bad",
          icon: service.cancel ? "checkCircle" : "close",
        },
        {
          key: "warranty",
          label: labels.factWarranty,
          value: service.refill ? labels.factYes : labels.factNo,
          tone: service.refill ? "good" : "bad",
          icon: service.refill ? "shield" : "close",
        },
      ]
    : [];

  if (state.success) {
    return (
      <div className="card card-pad text-center">
        <span className="inline-flex text-[var(--success)]">
          <Icon name="checkCircle" size={40} />
        </span>
        <h2 className="mt-4 text-xl font-bold">{labels.placed.replace("{id}", String(state.success.orderId))}</h2>
        <p className="muted mt-2 text-sm">
          {labels.charge}: <strong className="text-[var(--text)]">{fmt(state.success.charge)}</strong>
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/dashboard/orders" className="btn btn-primary btn-sm">
            <Icon name="list" size={15} />
            {labels.track}
          </Link>
          <a href="/dashboard/new-order" className="btn btn-ghost btn-sm">
            <Icon name="plus" size={15} />
            {labels.submit}
          </a>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-2" noValidate>
      <div className="card card-pad min-w-0 space-y-4">
        {state.error && (
          <div className="alert alert-danger" role="alert">
            <Icon name="alert" size={16} />
            <span>{state.error}</span>
          </div>
        )}

        {/* For the buyer who already knows the service. Above the cascade
            because it replaces it, not because it refines it. */}
        <Field name="quickFind" label={labels.quickFind} hint={labels.quickFindHint}>
          <ServiceSearch
            options={everything.map(({ service }) => ({
              value: service.id,
              label: service.name,
              code: String(service.publicId),
              meta: fmt(service.rate),
              keywords: service.description,
            }))}
            onPick={jumpTo}
            placeholder={labels.quickFindPlaceholder}
            emptyLabel={labels.noResults}
          />
        </Field>

        {/* A native select cannot draw the platform's mark, and the mark is
            how a customer picks: they recognise the logo before they read the
            word. Same control as the service step, with its search off — the
            whole list fits on screen and a search field over eight rows is in
            the way rather than a help. */}
        <Field name="platformId" label={labels.platform}>
          <Combobox
            name="platformId"
            value={platformId}
            onChange={(id) => {
              setPlatformId(id);
              setCategoryId("");
              setServiceId("");
            }}
            searchable={false}
            placeholder={labels.selectPlatform}
            searchPlaceholder={labels.selectPlatform}
            emptyLabel={labels.noResults}
            options={platforms.map((p) => ({
              value: p.id,
              label: p.name,
              icon: <PlatformMark platform={p} size={17} />,
            }))}
          />
        </Field>

        <Field name="categoryId" label={labels.category}>
          <select
            id="categoryId"
            name="categoryId"
            className="field"
            value={categoryId}
            disabled={!platformId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setServiceId("");
            }}
          >
            <option value="">{platformId ? labels.selectCategory : labels.selectPlatformFirst}</option>
            {visibleCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        {/* A catalogue runs to hundreds of services, so this is a searchable
            listbox rather than a native select. */}
        <Field name="serviceId" label={labels.service} error={state.fieldErrors?.serviceId}>
          <Combobox
            name="serviceId"
            value={serviceId}
            onChange={setServiceId}
            disabled={!categoryId}
            disabledLabel={categoryId ? labels.selectService : labels.selectCategoryFirst}
            placeholder={labels.selectService}
            searchPlaceholder={labels.searchService}
            emptyLabel={labels.noResults}
            invalid={Boolean(state.fieldErrors?.serviceId)}
            options={visibleServices.map((s) => ({
              value: s.id,
              label: s.name,
              code: String(s.publicId),
              meta: fmt(s.rate),
              keywords: s.description,
            }))}
          />
        </Field>

        {service && <OrderFacts facts={facts} />}

        {service?.description && (
          <div className="surface-2 rounded-xl p-3.5">
            <p className="text-sm leading-relaxed whitespace-pre-line">{service.description}</p>
          </div>
        )}

        {subscription ? (
          <>
            <Field
              name="username"
              label={labels.username}
              error={state.fieldErrors?.username}
              hint={labels.usernameHint}
              required
            >
              <TextInput
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="yourprofile"
                error={state.fieldErrors?.username}
                hint={labels.usernameHint}
              />
            </Field>

            <Field
              name="posts"
              label={labels.posts}
              error={state.fieldErrors?.posts}
              hint={labels.postsHint}
              required
            >
              <TextInput
                name="posts"
                type="number"
                inputMode="numeric"
                min={1}
                value={posts}
                onChange={(e) => setPosts(e.target.value)}
                placeholder="10"
                error={state.fieldErrors?.posts}
                hint={labels.postsHint}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                name="minPerPost"
                label={`${labels.min} · ${labels.perPost}`}
                error={state.fieldErrors?.min}
                required
              >
                <TextInput
                  name="minPerPost"
                  type="number"
                  inputMode="numeric"
                  value={minPerPost}
                  onChange={(e) => setMinPerPost(e.target.value)}
                  placeholder={String(service?.min ?? 100)}
                  error={state.fieldErrors?.min}
                />
              </Field>
              <Field
                name="maxPerPost"
                label={`${labels.max} · ${labels.perPost}`}
                error={state.fieldErrors?.max}
                required
              >
                <TextInput
                  name="maxPerPost"
                  type="number"
                  inputMode="numeric"
                  value={maxPerPost}
                  onChange={(e) => setMaxPerPost(e.target.value)}
                  placeholder={String(service?.max ?? 1000)}
                  error={state.fieldErrors?.max}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field name="delay" label={labels.delay} error={state.fieldErrors?.delay} hint={labels.delayHint}>
                <select
                  id="delay"
                  name="delay"
                  className="field"
                  value={delay}
                  onChange={(e) => setDelay(e.target.value)}
                >
                  {SUBSCRIPTION_DELAYS.map((d) => (
                    <option key={d} value={d}>
                      {d} {labels.minutes}
                    </option>
                  ))}
                </select>
              </Field>
              <Field name="expiry" label={labels.expiry} error={state.fieldErrors?.expiry} hint={labels.expiryHint}>
                <TextInput
                  name="expiry"
                  type="date"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  error={state.fieldErrors?.expiry}
                  hint={labels.expiryHint}
                />
              </Field>
            </div>
          </>
        ) : (
          <Field name="link" label={labels.link} error={state.fieldErrors?.link} required>
            <TextInput
              name="link"
              type="url"
              inputMode="url"
              defaultValue={prefill?.link ?? ""}
              placeholder={service?.linkExample || ""}
              error={state.fieldErrors?.link}
            />
          </Field>
        )}

        {subscription ? null : custom ? (
          <Field
            name="comments"
            label={labels.comments}
            error={
              state.fieldErrors?.comments ??
              (outOfRange && service
                ? `${labels.min} ${service.min.toLocaleString()} — ${labels.max} ${service.max.toLocaleString()}`
                : undefined)
            }
            hint={labels.commentsHint.replace("{count}", String(commentLines))}
            required
          >
            <textarea
              id="comments"
              name="comments"
              rows={6}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className={`field ${state.fieldErrors?.comments ? "field-error" : ""}`}
            />
          </Field>
        ) : (
        <Field
          name="quantity"
          label={labels.quantity}
          error={
            state.fieldErrors?.quantity ??
            (outOfRange && service
              ? `${labels.min} ${service.min.toLocaleString()} — ${labels.max} ${service.max.toLocaleString()}`
              : undefined)
          }
          hint={
            service
              ? `${labels.min} ${service.min.toLocaleString()} · ${labels.max} ${service.max.toLocaleString()}`
              : undefined
          }
          required
        >
          <TextInput
            name="quantity"
            type="number"
            inputMode="numeric"
            min={service?.min}
            max={service?.max}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={String(service?.min ?? 100)}
            error={state.fieldErrors?.quantity ?? (outOfRange ? "range" : undefined)}
            hint={service ? "range" : undefined}
          />
        </Field>
        )}

        {/* Progressive disclosure: drip-feed appears only for services that
            support it, and its inputs stay collapsed until it is switched on. */}
        {service?.dripfeed && !subscription && (
          <div className="surface-2 rounded-xl p-4">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
              <input
                type="checkbox"
                name="dripfeed"
                checked={dripfeed}
                onChange={(e) => setDripfeed(e.target.checked)}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              <Icon name="clock" size={16} />
              {labels.dripfeed}
            </label>

            {dripfeed && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field name="runs" label={labels.runs} error={state.fieldErrors?.runs} required>
                  <TextInput
                    name="runs"
                    type="number"
                    inputMode="numeric"
                    min={2}
                    value={runs}
                    onChange={(e) => setRuns(e.target.value)}
                    placeholder="10"
                    error={state.fieldErrors?.runs}
                  />
                </Field>
                <Field
                  name="interval"
                  label={labels.interval}
                  error={state.fieldErrors?.interval}
                  hint={labels.intervalHint}
                  required
                >
                  <TextInput
                    name="interval"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={interval}
                    onChange={(e) => setInterval(e.target.value)}
                    placeholder="60"
                    error={state.fieldErrors?.interval}
                    hint={labels.intervalHint}
                  />
                </Field>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------ summary */}
      <aside className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
        {accountCard}

        {service ? (
          <div className="card card-pad">
            <>
              <p className="text-sm font-semibold">{service.name}</p>
              <p className="muted mt-0.5 font-mono text-xs">#{service.publicId}</p>

              {!subscription && service.dripfeed && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Flag on label={labels.dripfeed} />
                </div>
              )}

              <div className="divider my-4" />

              <dl className="space-y-2.5 text-sm">
                <Row label={labels.id} value={<span className="font-mono text-xs">#{service.publicId}</span>} />
                <Row label={labels.limits} value={`${service.min.toLocaleString()} – ${service.max.toLocaleString()}`} />
                {/* A discount nobody can compare against is not persuasive, so
                    the list price stays visible with a line through it. */}
                {service.listRate > service.rate ? (
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="muted">{labels.rate}</dt>
                    <dd className="flex items-baseline gap-2">
                      <span className="muted text-xs line-through">{fmt(service.listRate)}</span>
                      <span className="font-semibold text-[var(--success)]">{fmt(service.rate)}</span>
                    </dd>
                  </div>
                ) : (
                  <Row label={labels.rate} value={fmt(service.rate)} />
                )}
                {subscription ? (
                  <>
                    <Row label={labels.posts} value={Number(posts) > 0 ? Number(posts).toLocaleString() : "—"} />
                    <Row label={labels.total} value={qty > 0 ? qty.toLocaleString() : "—"} />
                  </>
                ) : (
                  <Row label={labels.quantity} value={qty > 0 ? qty.toLocaleString() : "—"} />
                )}
                {dripfeed && runsNum > 1 && (
                  <>
                    <Row label={labels.runs} value={runsNum.toLocaleString()} />
                    <Row label={labels.total} value={units.toLocaleString()} />
                  </>
                )}
              </dl>

              <div className="divider my-4" />

              <div>
                <span className="muted text-xs tracking-wide uppercase">{labels.charge}</span>
                <p className="mt-0.5 text-2xl leading-tight font-bold tabular-nums">{fmt(charge)}</p>
              </div>

              {!affordable && charge > 0 && (
                <div className="alert alert-danger mt-4" role="alert">
                  <Icon name="alert" size={15} />
                  <span>{labels.insufficient}</span>
                </div>
              )}

              <SubmitButton className="btn btn-primary mt-4 w-full">
                <Icon name="cart" size={16} />
                {labels.submit}
              </SubmitButton>

              {!affordable && charge > 0 && (
                <Link href="/dashboard/wallet" className="btn btn-ghost btn-sm mt-2 w-full">
                  <Icon name="wallet" size={15} />
                  {labels.addFunds}
                </Link>
              )}
            </>
          </div>
        ) : null}
      </aside>
    </form>
  );
}

function Flag({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={`badge ${on ? "badge-success" : "badge-muted"}`}>
      <Icon name={on ? "check" : "close"} size={11} />
      {label}
    </span>
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
