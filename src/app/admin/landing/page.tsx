import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import LandingManager from "@/components/admin/landing-manager";

export const metadata: Metadata = { title: "Landing" };

export default async function AdminLandingPage() {
  const { t } = await getAppContext();

  const [testimonials, faqs] = await Promise.all([
    db.testimonial.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] }),
    db.faq.findMany({ orderBy: [{ position: "asc" }, { question: "asc" }] }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <LandingManager
        testimonials={testimonials}
        faqs={faqs}
        labels={{
          close: t("common.close"),
          title: t("landing.admin.title"),
          quotes: t("landing.admin.quotes"),
          faqs: t("landing.admin.faqs"),
          newQuote: t("landing.admin.newQuote"),
          newFaq: t("landing.admin.newFaq"),
          noQuotes: t("landing.admin.noQuotes"),
          noFaqs: t("landing.admin.noFaqs"),
          name: t("landing.admin.name"),
          role: t("landing.admin.role"),
          quote: t("landing.admin.quote"),
          rating: t("landing.admin.rating"),
          avatar: t("landing.admin.avatar"),
          question: t("landing.admin.question"),
          answer: t("landing.admin.answer"),
          visible: t("admin.visible"),
          hidden: t("page.hidden"),
          position: t("admin.position"),
          imageHint: t("setting.imageHint"),
          upload: t("admin.upload"),
          remove: t("admin.remove"),
          edit: t("admin.edit"),
          delete: t("admin.delete"),
          confirmDelete: t("admin.confirmDelete"),
          save: t("common.save"),
        }}
      />
    </div>
  );
}
