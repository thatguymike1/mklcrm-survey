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
    .select("id, opened_at")
    .eq("slug", slug)
    .single();

  if (!instance) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Record an opened event for every genuine load
  await supabase.from("survey_events").insert({
    survey_instance_id: instance.id,
    event_type: "opened",
  });

  // Set opened_at only on first-ever open
  if (!instance.opened_at) {
    await supabase
      .from("survey_instances")
      .update({ opened_at: new Date().toISOString() })
      .eq("id", instance.id);
  }

  return Response.json({ ok: true });
}
