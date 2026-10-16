import type { Metadata } from "next";

import BrandPanel from "@/components/brandPanel";
import HeaderBox from "@/components/ui/headerBox";
import { getT } from "@/lib/i18n/server";

import FeedbackForm from "../components/feedbackForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("feedback.metaTitle") };
}

// "Tell us what is missing": goes straight to the Horizon team (the admin portal lists it).
const Feedback = async ({ searchParams }: { searchParams: Promise<{ from?: string }> }) => {
  const t = await getT();
  const { from } = await searchParams;
  return (
    <section className="page">
      <HeaderBox eyebrow={t("feedback.eyebrow")} title={t("feedback.title")} subtext={t("feedback.intro")} />
      {/* The form alone left most of a wide screen empty; the brand panel keeps it company. */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,520px)] xl:items-stretch">
        <FeedbackForm from={typeof from === "string" ? from : ""} />
        <BrandPanel className="hidden rounded-lg xl:flex" />
      </div>
    </section>
  );
};

export default Feedback;
