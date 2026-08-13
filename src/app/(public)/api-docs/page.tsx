import type { Metadata } from "next";
import { getAppContext } from "@/lib/context";
import { getSetting } from "@/lib/settings";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "API" };

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
  const endpoint = `${process.env.APP_URL ?? "http://localhost:3000"}/api/v2`;

  const actions: Action[] = [
    {
      action: "services",
      summary: "List every service on sale.",
      params: [],
      response: [
        {
          service: 1001,
          name: "Instagram Followers - Real Mix",
          type: "Default",
          category: "Instagram Followers",
          rate: "21000.0000",
          min: "100",
          max: "100000",
          refill: true,
          cancel: true,
          dripfeed: true,
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
      summary: "Place an order. Include runs and interval for drip-feed.",
      params: [
        ["service", "Service id"],
        ["link", "Target link"],
        ["quantity", "Quantity"],
        ["runs", "Drip-feed runs (optional)"],
        ["interval", "Minutes between runs (optional)"],
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
                    <span className="muted">API key</span>
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
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
      <dt className="muted text-[0.82rem]">{label}</dt>
      <dd className={`break-all sm:text-right ${mono ? "font-mono text-xs" : "font-medium"}`}>{value}</dd>
    </div>
  );
}
