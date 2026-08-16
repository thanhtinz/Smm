import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { dateFormats } from "@/lib/dates";
import { getCurrentPanel } from "@/lib/tenancy";
import { parseTagList, summarise } from "@/lib/blog";
import { Icon } from "@/components/icons";

/**
 * One post.
 *
 * A post dated in the future is a 404 rather than a preview: the address is
 * public, and one that renders next week's announcement to anybody who guesses
 * the slug is not a schedule.
 */
// A function, not a constant: a module-level `new Date()` is the moment the
// server started, so a post scheduled after a deploy would stay a 404 until
// the next one.
const readable = () => ({ publishedAt: { not: null, lte: new Date() } });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  if (!(await getCurrentPanel())) return {};
  const { slug } = await params;

  const post = await db.blogPost.findFirst({
    where: { slug, ...readable() },
    select: { title: true, metaTitle: true, metaDescription: true, excerpt: true, body: true, coverUrl: true },
  });
  if (!post) return { title: "Not found" };

  const description = post.metaDescription || post.excerpt || summarise(post.body);
  return {
    title: post.metaTitle || post.title,
    description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: post.metaTitle || post.title,
      description,
      type: "article",
      ...(post.coverUrl ? { images: [post.coverUrl] } : {}),
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t, locale, timezone } = await getAppContext();
  const dates = dateFormats(locale, timezone);

  const post = await db.blogPost.findFirst({ where: { slug, ...readable() } });
  if (!post) notFound();

  return (
    <div className="container-page py-14">
      <article className="mx-auto max-w-3xl">
        <Link href="/blog" className="btn btn-ghost btn-sm">
          <Icon name="chevronLeft" size={15} />
          {t("blog.title")}
        </Link>

        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{post.title}</h1>

        <p className="muted mt-3 flex flex-wrap items-center gap-2 text-sm">
          <time dateTime={post.publishedAt!.toISOString()}>{dates.day(post.publishedAt!)}</time>
          {post.author && <span>· {post.author}</span>}
          {parseTagList(post.tags).map((name) => (
            <Link key={name} href={`/blog?tag=${encodeURIComponent(name)}`} className="badge badge-muted">
              {name}
            </Link>
          ))}
        </p>

        {post.coverUrl && (
          // Plain <img>: covers are uploaded through the panel's own media
          // route and served from it, which next/image would want configured
          // per host on every child panel's domain.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.coverUrl} alt="" className="mt-6 w-full rounded-xl" />
        )}

        {/* Written by the panel's own admin, which is the only author here. */}
        <div className="prose-page mt-8" dangerouslySetInnerHTML={{ __html: post.body }} />
      </article>
    </div>
  );
}
