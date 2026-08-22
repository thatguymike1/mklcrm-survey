import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  SurveySnapshotSchema,
  type SurveySnapshot,
  type LoadedResponse,
} from "./types";

export interface LoadedSurveyInstance {
  id: string;
  slug: string;
  snapshot: SurveySnapshot;
  submitted_at: string | null;
  opened_at: string | null;
  started_at: string | null;
  last_activity_at: string | null;
  responses: LoadedResponse[];
}

export async function getSurveyInstanceBySlug(
  slug: string,
): Promise<LoadedSurveyInstance | null> {
  const supabase = createClient();

  const { data: instance, error } = await supabase
    .from("survey_instances")
    .select(
      `
      id,
      slug,
      questions_snapshot,
      submitted_at,
      opened_at,
      started_at,
      last_activity_at,
      survey_responses(question_id, answer_text, answer_values)
    `,
    )
    .eq("slug", slug)
    .single();

  if (error || !instance) return null;

  const parseResult = SurveySnapshotSchema.safeParse(
    instance.questions_snapshot,
  );
  if (!parseResult.success) {
    console.error(
      "[survey] malformed snapshot for slug",
      slug,
      parseResult.error.flatten(),
    );
    return null;
  }

  const responses: LoadedResponse[] = (instance.survey_responses ?? []).map(
    (r) => ({
      question_id: r.question_id,
      answer_text: r.answer_text ?? null,
      answer_values: Array.isArray(r.answer_values)
        ? (r.answer_values as string[])
        : null,
    }),
  );

  return {
    id: instance.id,
    slug: instance.slug,
    snapshot: parseResult.data,
    submitted_at: instance.submitted_at,
    opened_at: instance.opened_at,
    started_at: instance.started_at,
    last_activity_at: instance.last_activity_at,
    responses,
  };
}
