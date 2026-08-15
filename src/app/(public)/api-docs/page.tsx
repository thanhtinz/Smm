import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { getSetting } from "@/lib/settings";
import { panelBaseUrl } from "@/lib/tenancy";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "API", alternates: { canonical: "/api-docs" } };

type Action = {
  action: string;
  summary: string;
  params: [string, string][];
  response: unknown;
};

export default async function ApiDocsPage() {
  const ctx = await getAppContext();
  const { t } = ctx;
  const enabled = await getSetting("api.enabled");
  const callbacksOn = await getSetting("api.callbacksEnabled");
  const endpoint = `${await panelBaseUrl()}/api/v2`;

  // The sample response shows a service this panel actually sells; a
  // hand-written one would advertise a catalogue a child panel does not have.
  const sample = await db.service.findFirst({
    where: { enabled: true },
    include: { category: { select: { name: true } } },
    orderBy: [{ position: "asc" }, { publicId: "asc" }],
  });

  const actions: Action[] = [
    {
      action: "services",
      summary: "List every service on sale.",
      params: [],
      response: [
        {
          service: sample?.publicId ?? 1001,
          name: sample?.name ?? "Service name",
          type: "Default",
          category: sample?.category.name ?? "Category",
          rate: (sample?.rate ?? 0).toFixed(4),
          min: String(sample?.min ?? 100),
          max: String(sample?.max ?? 100000),
          refill: sample?.refill ?? false,
          cancel: sample?.cancel ?? false,
          dripfeed: sample?.dripfeed ?? false,
        },
      ],
    },
    {
      action: "balance",
      summary: "Read the account balance.",
      params: [],
      response: { balance: "2847000", currency: "VND" },
    },
    {
      action: "add",
      summary: "Place an order. The service type decides which parameters apply.",
      params: [
        ["service", "Service id"],
        ["link", "Target link — Default and Custom Comments"],
        ["quantity", "Quantity — Default"],
        ["comments", "One comment per line — Custom Comments"],
        ["runs", "Drip-feed runs (optional)"],
        ["interval", "Minutes between runs (optional)"],
        ["username", "Profile to watch — Subscriptions"],
        ["posts", "Future posts covered — Subscriptions"],
        ["min", "Least per post — Subscriptions"],
        ["max", "Most per post — Subscriptions"],
        ["delay", "Minutes to wait after a post (optional)"],
        ["expiry", "dd/mm/yyyy end date (optional)"],
      ],
      response: { order: 100007 },
    },
    {
      action: "status",
      summary: "Read one order.",
      params: [["order", "Order id"]],
      response: { charge: "192000", start_count: "0", status: "Pending", remains: "8000", currency: "VND" },
    },
    {
      action: "orders",
      summary: "Read up to 100 orders at once.",
      params: [["orders", "Comma-separated order ids"]],
      response: {
        "100002": { charge: "192000", start_count: "0", status: "Pending", remains: "8000", currency: "VND" },
        "100003": { error: "Incorrect order ID" },
      },
    },
    {
      action: "refill",
      summary: "Ask for a refill. Only on services whose list entry says refill: true.",
      params: [
        ["order", "Order id — for one"],
        ["orders", "Comma-separated order ids — for several"],
      ],
      response: { refill: 4001 },
    },
    {
      action: "refill_status",
      summary: "Where a refill got to, by the id refill handed back.",
      params: [
        ["refill", "Refill id — for one"],
        ["refills", "Comma-separated refill ids — for several"],
      ],
      response: { status: "In progress" },
    },
    {
      action: "cancel",
      summary: "Ask to cancel. Only on services whose list entry says cancel: true, and only before delivery has really started.",
      params: [["orders", "Comma-separated order ids"]],
      response: [{ order: 100007, cancel: 4002 }],
    },
  ];

  return (
    <div className="container-page py-12">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("api.title")}</h1>
      <p className="muted mt-3 max-w-2xl leading-relaxed">{t("api.intro")}</p>

      {!enabled && (
        <div className="alert alert-warning mt-6 max-w-2xl" role="status">
          <Icon name="alert" size={16} />
          <span>{t("api.disabled")}</span>
        </div>
      )}

      <div className="card card-pad mt-8 max-w-3xl">
        <dl className="space-y-2.5 text-sm">
          <Row label="HTTP" value="POST" />
          <Row label="URL" value={endpoint} mono />
          <Row label={t("api.key")} value="key" mono />
        </dl>
      </div>

      <div className="mt-8 space-y-5">
        {actions.map((a) => (
          <section key={a.action} className="card overflow-hidden">
            <header className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-5 py-4">
              <code className="rounded-lg bg-[color-mix(in_srgb,var(--primary)_16%,transparent)] px-2.5 py-1 font-mono text-sm font-semibold text-[var(--primary)]">
                {a.action}
              </code>
              <span className="muted text-sm">{a.summary}</span>
            </header>

            <div className="grid gap-5 p-5 lg:grid-cols-2">
              <div className="min-w-0">
                <h3 className="muted mb-2 text-[0.68rem] font-semibold tracking-widest uppercase">{t("api.params")}</h3>
                <ul className="space-y-1.5 text-sm">
                  <li className="flex gap-3">
                    <code className="shrink-0 font-mono text-xs">key</code>
                    <span className="muted">{t("api.key")}</span>
                  </li>
                  <li className="flex gap-3">
                    <code className="shrink-0 font-mono text-xs">action</code>
                    <span className="muted">{a.action}</span>
                  </li>
                  {a.params.map(([name, desc]) => (
                    <li key={name} className="flex gap-3">
                      <code className="shrink-0 font-mono text-xs">{name}</code>
                      <span className="muted">{desc}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="min-w-0">
                <h3 className="muted mb-2 text-[0.68rem] font-semibold tracking-widest uppercase">{t("api.example")}</h3>
                <pre className="surface-2 scroll-x rounded-xl p-3.5 font-mono text-[0.72rem] leading-relaxed">
                  {JSON.stringify(a.response, null, 2)}
                </pre>
              </div>
            </div>
          </section>
        ))}
      </div>

      {callbacksOn && (
        <section className="card mt-8 max-w-3xl overflow-hidden">
          <header className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="font-semibold">{t("api.callback.title")}</h2>
            <p className="muted mt-1 text-sm">{t("api.callback.docs")}</p>
          </header>
          <div className="space-y-4 p-5">
            <div>
              <h3 className="muted mb-2 text-[0.68rem] font-semibold tracking-widest uppercase">{t("api.callback.body")}</h3>
              <pre className="surface-2 scroll-x rounded-xl p-3.5 font-mono text-[0.72rem] leading-relaxed">
                {JSON.stringify({ order: 100234, status: "Completed", start_count: 1200, remains: 0, charge: 24000 }, null, 2)}
              </pre>
            </div>
            <div>
              <h3 className="muted mb-2 text-[0.68rem] font-semibold tracking-widest uppercase">{t("api.callback.verify")}</h3>
              {/* Node because that is what most resellers here run, and the
                  point is the two rules that are easy to get wrong: hash the
                  raw bytes, and compare in constant time. */}
              <pre className="surface-2 scroll-x rounded-xl p-3.5 font-mono text-[0.72rem] leading-relaxed">
                {CALLBACK_EXAMPLE}
              </pre>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

const CALLBACK_EXAMPLE = `const raw = await request.text();          // the raw body, not JSON.parse'd
const mine = crypto
  .createHmac("sha256", MY_API_KEY)
  .update(raw)
  .digest("hex");

const theirs = request.headers.get("x-signature");
if (mine.length !== theirs.length ||
    !crypto.timingSafeEqual(Buffer.from(mine), Buffer.from(theirs))) {
  return new Response("bad signature", { status: 401 });
}

const { order, status, remains } = JSON.parse(raw);`;

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
      <dt className="muted text-[0.82rem]">{label}</dt>
      <dd className={`break-all sm:text-right ${mono ? "font-mono text-xs" : "font-medium"}`}>{value}</dd>
    </div>
  );
}
