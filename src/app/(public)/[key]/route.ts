import { notFound } from "next/navigation";
import { getSetting } from "@/lib/settings";
import { getCurrentPanel } from "@/lib/tenancy";

/**
 * The IndexNow key file.
 *
 * The protocol asks the site to serve its own key as plain text at the root.
 * Fetching it is how an engine confirms whoever submitted those URLs controls
 * the site, so this is the entire authentication and it has to be exact: the
 * body is the key and nothing else.
 *
 * Anything else at the root is a 404, so this route stays out of the way of
 * real pages.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!(await getCurrentPanel())) notFound();

  const configured = String((await getSetting("seo.indexNowKey")) ?? "").trim();
  if (!configured || key !== `${configured}.txt`) notFound();

  return new Response(configured, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
