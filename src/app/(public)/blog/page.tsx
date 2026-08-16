import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { dateFormats } from "@/lib/dates";
import { getCurrentPanel } from "@/lib/tenancy";
import { getSetting } from "@/lib/settings";
import { parseTagList } from "@/lib/blog";

/**
 * The blog index.
 *
 * Read by people who have not signed up yet — that is the whole reason it
 * exists — so it lives in the public layout with the landing page rather than
 * behind the dashboard.
 */

export async function generateMetadata(): Promise<Metadata> {
  if (!(await getCurrentPanel())) return {};
  const site = String(await getSetting("site.name"));
  return { title: `Blog — ${site}`, alternates: { canonical: "/blog" } };
}

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag } = await searchParams;
  const { t, locale, timezone } = await getAppContext();
  const dates = dateFormats(locale, timezone);

  // Published *and* not dated in the future: a scheduled post appears the
  // moment its time passes, with nothing having to run to make that happen.
  const posts = await db.blogPost.findMany({
    where: { publishedAt: { not: null, lte: new Date() } },
    orderBy: { publishedAt: "desc" },
    take: 60,
  });

  // Every tag actually in use, so the filter cannot offer an empty result.
  const tags = [...new Set(posts.flatMap((p) => parseTagList(p.tags)))].sort();
  const shown = tag ? posts.filter((p) => parseTagList(p.tags).includes(tag)) : posts;

  return (
    <div className="container-page py-14">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("blog.title")}</h1>

        {tags.length > 0 && (
          <nav className="mt-6 flex flex-wrap gap-2" aria-label={t("blog.title")}>
            <Link href="/blog" className={tag ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm"}>
              {t("blog.allTags")}
            </Link>
            {tags.map((name) => (
              <Link
                key={name}
                href={`/blog?tag=${encodeURIComponent(name)}`}
                className={tag === name ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
              >
                {name}
              </Link>
            ))}
          </nav>
        )}

        {shown.length === 0 ? (
          <p className="muted mt-10 text-sm">{t("blog.none")}</p>
        ) : (
          <ul className="mt-10 space-y-4">
            {shown.map((post) => (
              <li key={post.id} className="card card-pad">
                <article>
                  <Link href={`/blog/${post.slug}`} className="text-lg font-semibold hover:underline">
                    {post.title}
                  </Link>
                  {post.excerpt && <p className="muted mt-1.5 text-sm leading-relaxed">{post.excerpt}</p>}
                  <p className="muted mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <time dateTime={post.publishedAt!.toISOString()}>{dates.day(post.publishedAt!)}</time>
                    {post.author && <span>· {post.author}</span>}
                    {parseTagList(post.tags).map((name) => (
                      <span key={name} className="badge badge-muted">
                        {name}
                      </span>
                    ))}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
