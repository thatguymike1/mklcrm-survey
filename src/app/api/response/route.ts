import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { SurveySnapshotSchema } from "@/lib/survey/types";

const BodySchema = z.object({
  slug: z.string().min(1).max(200),
  question_id: z.string().uuid(),
  answer_text: z.string().max(10000).nullable().optional(),
  answer_values: z.array(z.string().uuid()).max(200).nullable().optional(),
});

function answersAreIdentical(
  existing: { answer_text: string | null; answer_values: unknown } | null,
  incoming: { answer_text?: string | null; answer_values?: string[] | null },
): boolean {
  if (!existing) return false;

  const newText = incoming.answer_text ?? null;
  const oldText = existing.answer_text ?? null;
  if (newText !== oldText) return false;

  const newVals = [...(incoming.answer_values ?? [])].sort().join("\0");
  const oldVals = [
    ...(Array.isArray(existing.answer_values)
      ? (existing.answer_values as string[])
      : []),
  ]
    .sort()
    .join("\0");
  return newVals === oldVals;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { slug, question_id, answer_text, answer_values } = parsed.data;
  const supabase = createClient();

  // Resolve instance by slug — never accept instance_id from client
  const { data: instance } = await supabase
    .from("survey_instances")
    .select("id, submitted_at, questions_snapshot, started_at")
    .eq("slug", slug)
    .single();

  if (!instance) {
    return Response.json({ error: "Survey not found" }, { status: 404 });
  }
  if (instance.submitted_at) {
    return Response.json({ error: "Survey already submitted" }, { status: 409 });
  }

  // Validate snapshot and verify question membership
  const snapshotResult = SurveySnapshotSchema.safeParse(
    instance.questions_snapshot,
  );
  if (!snapshotResult.success) {
    console.error("[response] malformed snapshot for slug", slug);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }

  const snapshot = snapshotResult.data;
  const question = snapshot.questions.find((q) => q.id === question_id);
  if (!question) {
    return Response.json({ error: "Invalid question" }, { status: 422 });
  }

  // Validate answer against question type and options
  if (question.answer_type === "free_text") {
    if (typeof answer_text !== "string") {
      return Response.json(
        { error: "answer_text required for free_text questions" },
        { status: 422 },
      );
    }
  } else {
    // single_select or multi_select
    if (!Array.isArray(answer_values) || answer_values.length === 0) {
      return Response.json(
        { error: "answer_values required for select questions" },
        { status: 422 },
      );
    }
    if (question.answer_type === "single_select" && answer_values.length !== 1) {
      return Response.json(
        { error: "single_select requires exactly one value" },
        { status: 422 },
      );
    }
    const validOptionIds = new Set(question.options.map((o) => o.id));
    for (const v of answer_values) {
      if (!validOptionIds.has(v)) {
        return Response.json({ error: "Invalid option value" }, { status: 422 });
      }
    }
  }

  // Fetch existing response to detect actual change (avoid noise in event log)
  const { data: existing } = await supabase
    .from("survey_responses")
    .select("answer_text, answer_values")
    .eq("instance_id", instance.id)
    .eq("question_id", question_id)
    .maybeSingle();

  const unchanged = answersAreIdentical(existing, { answer_text, answer_values });

  // Upsert response — ON CONFLICT(instance_id, question_id) DO UPDATE
  const now = new Date().toISOString();
  const { error: upsertError } = await supabase
    .from("survey_responses")
    .upsert(
      {
        instance_id: instance.id,
        question_id,
        answer_text: answer_text ?? null,
        answer_values: answer_values ?? null,
        updated_at: now,
      },
      { onConflict: "instance_id,question_id" },
    );

  if (upsertError) {
    console.error("[response] upsert error", upsertError);
    return Response.json({ error: "Failed to save response" }, { status: 500 });
  }

  // Only log event and update lifecycle timestamps when answer actually changed
  if (!unchanged) {
    await supabase.from("survey_events").insert({
      survey_instance_id: instance.id,
      event_type: "answered",
      question_id,
    });

    const updates: Record<string, string> = { last_activity_at: now };
    if (!instance.started_at) updates.started_at = now;

    await supabase
      .from("survey_instances")
      .update(updates)
      .eq("id", instance.id);
  }

  return Response.json({ ok: true });
}
