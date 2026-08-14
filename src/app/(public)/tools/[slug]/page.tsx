import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppContext } from "@/lib/context";
import { Icon } from "@/components/icons";
import ToolBody from "@/components/tools/registry";
import { enabledTools, findTool } from "@/lib/tools";

/**
 * Never pre-rendered. Which tools exist is a per-panel setting resolved from
 * the request Host, so a statically generated page would serve one panel's
 * choices to another — and, as this cost me once, keep serving a 404 after
 * the operator switched a tool back on.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { t } = await getAppContext();
  const tool = findTool(slug);
  if (!tool) return {};
  return { title: t(`tool.${slug}.name`), description: t(`tool.${slug}.about`) };
}

/**
 * Every label the tool components need.
 *
 * They are client components, so they cannot reach the dictionary themselves;
 * one object crosses the boundary instead of fifteen prop lists.
 */
function toolLabels(t: (key: string) => string): Record<string, string> {
  return {
    input: t("tools.input"),
    result: t("tools.result"),
    copy: t("tools.copy"),
    copied: t("tools.copied"),
    download: t("tools.download"),
    encode: t("tools.encode"),
    decode: t("tools.decode"),
    indent: t("tools.indent"),
    local: t("tools.localTime"),
    badBase64: t("tools.badBase64"),
    badUrl: t("tools.badUrl"),
    followers: t("landing.stat.users"),
    reactions: t("tools.reactions"),
    "case.upper": t("tools.case.upper"),
    "case.lower": t("tools.case.lower"),
    "case.title": t("tools.case.title"),
    "case.sentence": t("tools.case.sentence"),
    "case.camel": t("tools.case.camel"),
    "count.words": t("tools.count.words"),
    "count.characters": t("tools.count.characters"),
    "count.withoutSpaces": t("tools.count.withoutSpaces"),
    "count.lines": t("tools.count.lines"),
    "count.reading": t("tools.count.reading"),
    "password.length": t("tools.password.length"),
    "password.lower": t("tools.password.lower"),
    "password.upper": t("tools.password.upper"),
    "password.digits": t("tools.password.digits"),
    "password.symbols": t("tools.password.symbols"),
    "password.generate": t("tools.password.generate"),
  };
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getAppContext();
  const { t, settings, locale } = ctx;

  if (settings["tools.enabled"] === false) notFound();
  const tool = findTool(slug);
  // A tool the operator switched off is a 404 rather than a locked door: it
  // is not their tool to offer, so as far as this panel goes it is not there.
  if (!tool || !enabledTools(settings["tools.disabled"]).some((x) => x.slug === slug)) notFound();

  return (
    <div className="container-page max-w-3xl py-12">
      <Link href="/tools" className="btn btn-ghost btn-sm">
        <Icon name="chevronLeft" size={15} />
        {t("tools.back")}
      </Link>

      <header className="mt-5">
        <h1 className="text-3xl font-extrabold tracking-[-0.02em]">{t(`tool.${slug}.name`)}</h1>
        <p className="muted mt-2 leading-relaxed">{t(`tool.${slug}.about`)}</p>
      </header>

      <div className="card card-pad mt-7 px-6 py-6">
        <ToolBody slug={slug} labels={toolLabels(t)} locale={locale} />
      </div>

      <p className="muted mt-4 flex items-start gap-2 text-xs leading-relaxed">
        <span className="mt-0.5 shrink-0">
          <Icon name="lock" size={14} />
        </span>
        {t("tools.privacy")}
      </p>
    </div>
  );
}
