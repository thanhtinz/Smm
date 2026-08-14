"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Icon } from "@/components/icons";
import { CopyButton, Labelled, Output, type ToolLabels } from "./shell";

export type { ToolLabels };

// -------------------------------------------------------------------- qr

export function QrTool({ labels }: { labels: ToolLabels }) {
  const [text, setText] = useState("");
  const [png, setPng] = useState("");

  useEffect(() => {
    if (!text.trim()) {
      setPng("");
      return;
    }
    let live = true;
    // Rendered locally by the same library the deposit slips use, so nothing
    // typed here leaves the machine.
    QRCode.toDataURL(text, { width: 512, margin: 2, errorCorrectionLevel: "M" })
      .then((url) => live && setPng(url))
      .catch(() => live && setPng(""));
    return () => {
      live = false;
    };
  }, [text]);

  return (
    <div className="space-y-4">
      <Labelled htmlFor="qr-text" label={labels.input}>
        <textarea
          id="qr-text"
          rows={3}
          className="field"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="https://"
        />
      </Labelled>

      {png && (
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={png} alt="" width={256} height={256} className="rounded-[var(--radius)] bg-white p-3" />
          <a href={png} download="qr.png" className="btn btn-primary btn-sm">
            <Icon name="download" size={15} />
            {labels.download}
          </a>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------- utm

const UTM_FIELDS = ["source", "medium", "campaign", "content", "term"] as const;

export function UtmTool({ labels }: { labels: ToolLabels }) {
  const [base, setBase] = useState("");
  const [parts, setParts] = useState<Record<string, string>>({});

  const built = useMemo(() => {
    if (!base.trim()) return "";
    try {
      const url = new URL(base.trim());
      for (const f of UTM_FIELDS) {
        const v = parts[f]?.trim();
        // An empty parameter is worse than a missing one: it reports "no
        // source" to analytics rather than leaving the visit unattributed.
        if (v) url.searchParams.set(`utm_${f}`, v);
      }
      return url.toString();
    } catch {
      return "";
    }
  }, [base, parts]);

  const invalid = Boolean(base.trim()) && !built;

  return (
    <div className="space-y-4">
      <Labelled htmlFor="utm-base" label="URL">
        <input
          id="utm-base"
          className="field"
          value={base}
          onChange={(e) => setBase(e.target.value)}
          placeholder="https://example.com/page"
          aria-invalid={invalid || undefined}
        />
      </Labelled>

      <div className="grid gap-3 sm:grid-cols-2">
        {UTM_FIELDS.map((f) => (
          <Labelled key={f} htmlFor={`utm-${f}`} label={`utm_${f}`}>
            <input
              id={`utm-${f}`}
              className="field"
              value={parts[f] ?? ""}
              onChange={(e) => setParts({ ...parts, [f]: e.target.value })}
            />
          </Labelled>
        ))}
      </div>

      {built && <Output value={built} label={labels.result} labels={labels} />}
    </div>
  );
}

// ------------------------------------------------------------------ slug

/** Vietnamese marks come off by decomposition; đ has no combining form. */
export function stripMarks(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export function slugify(input: string): string {
  return stripMarks(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function SlugTool({ labels }: { labels: ToolLabels }) {
  const [text, setText] = useState("");
  return (
    <div className="space-y-4">
      <Labelled htmlFor="slug-in" label={labels.input}>
        <input id="slug-in" className="field" value={text} onChange={(e) => setText(e.target.value)} />
      </Labelled>
      {text && <Output value={slugify(text)} label={labels.result} labels={labels} />}
    </div>
  );
}

export function DiacriticsTool({ labels }: { labels: ToolLabels }) {
  const [text, setText] = useState("");
  return (
    <div className="space-y-4">
      <Labelled htmlFor="dia-in" label={labels.input}>
        <textarea id="dia-in" rows={5} className="field" value={text} onChange={(e) => setText(e.target.value)} />
      </Labelled>
      {text && <Output value={stripMarks(text)} label={labels.result} labels={labels} mono={false} />}
    </div>
  );
}

// --------------------------------------------------------- meta preview

// Google measures pixels, not characters, but a character count is the
// number people can act on. These are the widely used cut-off points.
const TITLE_LIMIT = 60;
const DESC_LIMIT = 155;

export function MetaPreviewTool({ labels }: { labels: ToolLabels }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [url, setUrl] = useState("");

  const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

  return (
    <div className="space-y-4">
      <Labelled htmlFor="meta-url" label="URL">
        <input id="meta-url" className="field" value={url} onChange={(e) => setUrl(e.target.value)} />
      </Labelled>
      <Labelled htmlFor="meta-title" label={`Title — ${title.length}/${TITLE_LIMIT}`}>
        <input
          id="meta-title"
          className="field"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={title.length > TITLE_LIMIT || undefined}
        />
      </Labelled>
      <Labelled htmlFor="meta-desc" label={`Description — ${desc.length}/${DESC_LIMIT}`}>
        <textarea
          id="meta-desc"
          rows={3}
          className="field"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          aria-invalid={desc.length > DESC_LIMIT || undefined}
        />
      </Labelled>

      {(title || desc) && (
        <div className="surface-2 rounded-[var(--radius)] p-4">
          <p className="muted truncate text-xs">{url || "example.com"}</p>
          <p className="mt-1 text-lg text-[var(--primary)]">{clip(title, TITLE_LIMIT) || "—"}</p>
          <p className="muted mt-1 text-sm leading-relaxed">{clip(desc, DESC_LIMIT)}</p>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------- engagement rate

export function EngagementTool({ labels }: { labels: ToolLabels }) {
  const [followers, setFollowers] = useState("");
  const [reactions, setReactions] = useState("");

  const f = Number(followers) || 0;
  const r = Number(reactions) || 0;
  const rate = f > 0 ? (r / f) * 100 : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Labelled htmlFor="er-f" label={labels.followers}>
          <input
            id="er-f"
            type="number"
            inputMode="numeric"
            className="field"
            value={followers}
            onChange={(e) => setFollowers(e.target.value)}
          />
        </Labelled>
        <Labelled htmlFor="er-r" label={labels.reactions}>
          <input
            id="er-r"
            type="number"
            inputMode="numeric"
            className="field"
            value={reactions}
            onChange={(e) => setReactions(e.target.value)}
          />
        </Labelled>
      </div>

      {rate !== null && (
        <div className="surface-2 flex items-baseline gap-3 rounded-[var(--radius)] p-5">
          <span className="font-mono text-4xl font-bold">{rate.toFixed(2)}%</span>
          <CopyButton value={`${rate.toFixed(2)}%`} labels={labels} />
        </div>
      )}
    </div>
  );
}
