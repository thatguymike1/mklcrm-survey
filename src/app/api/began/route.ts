import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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
    .select("id, submitted_at")
    .eq("slug", slug)
    .single();

  if (!instance) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (instance.submitted_at) {
    // Already submitted — treat as already began
    return Response.json({ ok: true });
  }

  // Insert began event idempotently. The partial unique index on
  // (survey_instance_id) WHERE event_type = 'began' makes this race-safe.
  const { error: insertError } = await supabase.from("survey_events").insert({
    survey_instance_id: instance.id,
    event_type: "began",
  });

  if (insertError) {
    // 23505 = unique_violation — duplicate began (double-click race). Treat as success.
    if (insertError.code !== "23505") {
      return Response.json({ error: "Failed to record began event" }, { status: 500 });
    }
  }

  return Response.json({ ok: true });
}
