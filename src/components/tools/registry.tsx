"use client";

import { QrTool, UtmTool, SlugTool, DiacriticsTool, MetaPreviewTool, EngagementTool, type ToolLabels } from "./marketing";
import { JsonTool, Base64Tool, UrlTool, HashTool, TimestampTool, ColorTool } from "./developer";
import { CaseTool, WordCountTool, PasswordTool } from "./text";

/**
 * Slug to component.
 *
 * One client boundary for all fifteen: the page that renders a tool is a
 * server component, and this is the single "use client" door it goes through.
 */
export default function ToolBody({
  slug,
  labels,
  locale,
}: {
  slug: string;
  labels: ToolLabels;
  locale: string;
}) {
  switch (slug) {
    case "qr":
      return <QrTool labels={labels} />;
    case "utm":
      return <UtmTool labels={labels} />;
    case "slug":
      return <SlugTool labels={labels} />;
    case "diacritics":
      return <DiacriticsTool labels={labels} />;
    case "meta-preview":
      return <MetaPreviewTool labels={labels} />;
    case "engagement-rate":
      return <EngagementTool labels={labels} />;
    case "json":
      return <JsonTool labels={labels} />;
    case "base64":
      return <Base64Tool labels={labels} />;
    case "url-encode":
      return <UrlTool labels={labels} />;
    case "hash":
      return <HashTool labels={labels} />;
    case "timestamp":
      return <TimestampTool labels={labels} locale={locale} />;
    case "color":
      return <ColorTool labels={labels} />;
    case "case":
      return <CaseTool labels={labels} />;
    case "word-count":
      return <WordCountTool labels={labels} locale={locale} />;
    case "password":
      return <PasswordTool labels={labels} />;
    default:
      return null;
  }
}
