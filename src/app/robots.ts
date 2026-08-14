import type { MetadataRoute } from "next";
import { panelBaseUrl, getCurrentPanel } from "@/lib/tenancy";
import { PRIVATE_PATHS, isIndexable } from "@/lib/seo";

/**
 * Per panel, resolved from the request host.
 *
 * Next treats this file as static by default, which would serve the root
 * panel's rules on every child's domain. It reads headers, so it is dynamic.
 */
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  // A host this deployment does not serve gets no instructions at all.
  if (!(await getCurrentPanel())) return { rules: { userAgent: "*", disallow: "/" } };

  const base = await panelBaseUrl();

  // A panel still being set up should not be in an index it will take weeks
  // to leave, so "closed" here means closed to everybody.
  if (!(await isIndexable())) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
