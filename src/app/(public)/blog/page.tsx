import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getAppContext, readerMessages } from "@/lib/context";
import { dateFormats } from "@/lib/dates";
import { getCurrentPanel } from "@/lib/tenancy";
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
  // Bare, and in the reader's language. The root layout already appends the
  // site name through its title template, so spelling it out here rendered
  // "Blog — Acme · Acme"; and "Blog" written into the code is the one part of
  // the page that reaches a Vietnamese reader's tab and bookmarks.
  const t = await readerMessages();
  return { title: t("blog.title"), alternates: { canonical: "/blog" } };
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
  const live = { publishedAt: { not: null, lte: new Date() } };

  const [tagRows, posts] = await Promise.all([
    // Every tag in use, across the whole blog rather than across one page of
    // it — otherwise a tag carried only by older posts disappears from the
    // filter while its posts are still live.
    db.blogPost.findMany({ where: live, select: { tags: true } }),
    db.blogPost.findMany({
      // The tag belongs in the query, not after it. Filtering the newest 60 in
      // JavaScript meant a tag whose posts all sat outside that window
      // answered "nothing here yet" — on a link this very blog hands out, from
      // every post that carries the tag.
      where: tag ? { ...live, tags: { contains: tag } } : live,
      orderBy: { publishedAt: "desc" },
      take: 60,
    }),
  ]);

  const tags = [...new Set(tagRows.flatMap((p) => parseTagList(p.tags)))].sort();
  // `contains` is a substring match, so "seo" would also fetch "seo-tips".
  // The exact membership check still decides; it just no longer decides which
  // rows were fetched.
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
