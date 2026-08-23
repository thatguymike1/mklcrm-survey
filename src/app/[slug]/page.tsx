import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSurveyInstanceBySlug } from "@/lib/survey/instance";
import { SurveyClient } from "./survey-client";

interface Props {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function SurveyPage({ params }: Props) {
  const { slug } = await params;

  // Reject obviously invalid slugs before hitting the DB
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(slug)) {
    notFound();
  }

  const instance = await getSurveyInstanceBySlug(slug);
  if (!instance) notFound();

  if (instance.snapshot.questions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <p className="text-gray-500 text-sm">
          This survey has no questions.
        </p>
      </div>
    );
  }

  return (
    <SurveyClient
      slug={slug}
      snapshot={instance.snapshot}
      initialResponses={instance.responses}
      initialSubmitted={instance.submitted_at !== null}
      initialBegan={instance.began}
    />
  );
}
