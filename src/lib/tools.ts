import type { IconName } from "@/components/icons";

/**
 * The free tools.
 *
 * These exist to bring people to the panel who are not looking for a panel:
 * somebody needs a QR code or wants to know why their JSON will not parse,
 * lands here, and finds out what else the site sells. So every one of them
 * has to work without an account, without a key and without a round trip —
 * they all run in the browser.
 *
 * A tool is code, so the list lives here. Which of them a panel offers is an
 * operator's decision and lives in the `tools.disabled` setting.
 */

export const TOOL_GROUPS = ["marketing", "developer", "text"] as const;
export type ToolGroup = (typeof TOOL_GROUPS)[number];

export type Tool = {
  slug: string;
  group: ToolGroup;
  icon: IconName;
};

export const TOOLS: Tool[] = [
  // --- Marketing ----------------------------------------------------------
  { slug: "qr", group: "marketing", icon: "code" },
  { slug: "utm", group: "marketing", icon: "link" },
  { slug: "slug", group: "marketing", icon: "link" },
  { slug: "meta-preview", group: "marketing", icon: "search" },
  { slug: "engagement-rate", group: "marketing", icon: "trending" },

  // --- Developer ----------------------------------------------------------
  { slug: "json", group: "developer", icon: "code" },
  { slug: "base64", group: "developer", icon: "layers" },
  { slug: "url-encode", group: "developer", icon: "link" },
  { slug: "hash", group: "developer", icon: "lock" },
  { slug: "timestamp", group: "developer", icon: "clock" },
  { slug: "color", group: "developer", icon: "palette" },

  // --- Text ---------------------------------------------------------------
  { slug: "case", group: "text", icon: "document" },
  { slug: "word-count", group: "text", icon: "list" },
  { slug: "diacritics", group: "text", icon: "language" },
  { slug: "password", group: "text", icon: "key" },
];

export function findTool(slug: string): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

/**
 * The tools this panel offers.
 *
 * Stored as the disabled list rather than the enabled one, so a tool added in
 * a later version shows up for everybody instead of staying invisible until
 * each operator notices it and ticks a box.
 */
export function enabledTools(disabled: unknown): Tool[] {
  const off = new Set(Array.isArray(disabled) ? disabled.map(String) : []);
  return TOOLS.filter((t) => !off.has(t.slug));
}
