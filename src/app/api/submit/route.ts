import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { SurveySnapshotSchema } from "@/lib/survey/types";

const BodySchema = z.object({
  slug: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const { slug } = parsed.data;
  const supabase = createClient();

  const { data: instance } = await supabase
    .from("survey_instances")
    .select("id, submitted_at, questions_snapshot")
    .eq("slug", slug)
    .single();

  if (!instance) {
    return Response.json({ error: "Survey not found" }, { status: 404 });
  }
  if (instance.submitted_at) {
    return Response.json({ error: "Already submitted" }, { status: 409 });
  }

  const snapshotResult = SurveySnapshotSchema.safeParse(
    instance.questions_snapshot,
  );
  if (!snapshotResult.success) {
    console.error("[submit] malformed snapshot for slug", slug);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }

  const snapshot = snapshotResult.data;
  const requiredQuestions = snapshot.questions.filter((q) => q.required);

  // Fetch all responses for this instance
  const { data: responses } = await supabase
    .from("survey_responses")
    .select("question_id, answer_text, answer_values")
    .eq("instance_id", instance.id);

  const responseMap = new Map(
    (responses ?? []).map((r) => [r.question_id, r]),
  );

  // Validate every required question has a valid response
  for (const q of requiredQuestions) {
    const r = responseMap.get(q.id);
    if (!r) {
      return Response.json(
        { error: "Required question not answered", question_id: q.id },
        { status: 422 },
      );
    }
    if (q.answer_type === "free_text") {
      if (!r.answer_text || r.answer_text.trim() === "") {
        return Response.json(
          { error: "Required question has empty answer", question_id: q.id },
          { status: 422 },
        );
      }
    } else {
      if (!Array.isArray(r.answer_values) || r.answer_values.length === 0) {
        return Response.json(
          { error: "Required question has no selection", question_id: q.id },
          { status: 422 },
        );
      }
    }
  }

  // Atomic submit: only succeeds if submitted_at is still null (race protection)
  const now = new Date().toISOString();
  const { data: updated } = await supabase
    .from("survey_instances")
    .update({ submitted_at: now, last_activity_at: now })
    .eq("id", instance.id)
    .is("submitted_at", null)
    .select("id");

  if (!updated || updated.length === 0) {
    // Another request submitted concurrently
    return Response.json({ error: "Already submitted" }, { status: 409 });
  }

  await supabase.from("survey_events").insert({
    survey_instance_id: instance.id,
    event_type: "submitted",
  });

  return Response.json({ ok: true });
}
