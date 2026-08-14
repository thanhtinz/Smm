import type { MetadataRoute } from "next";
import { getCurrentPanel } from "@/lib/tenancy";
import { isIndexable, publicUrls } from "@/lib/seo";

/** Dynamic for the same reason robots.ts is: one file, many hostnames. */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!(await getCurrentPanel())) return [];
  // Listing pages a panel has asked not to be indexed would undo the request.
  if (!(await isIndexable())) return [];

  return (await publicUrls()).map((entry) => ({
    url: entry.url,
    lastModified: entry.lastModified,
    priority: entry.priority,
  }));
}
