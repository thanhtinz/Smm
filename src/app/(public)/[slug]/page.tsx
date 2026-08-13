import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentPanel } from "@/lib/tenancy";

/**
 * Static pages — terms, privacy, refund — edited from Admin → Pages and linked
 * from the footer. Each panel has its own set, so the same slug renders
 * different words depending on which panel is being served.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  if (!(await getCurrentPanel())) return {};
  const { slug } = await params;
  const page = await db.page.findFirst({ where: { slug, published: true }, select: { title: true } });
  return { title: page?.title ?? "Not found" };
}

export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await db.page.findFirst({ where: { slug, published: true } });
  if (!page) notFound();

  return (
    <div className="container-page py-14">
      <article className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{page.title}</h1>
        {/* Written by the panel's own admin, which is the only author here. */}
        <div className="prose-page mt-8" dangerouslySetInnerHTML={{ __html: page.body }} />
      </article>
    </div>
  );
}
