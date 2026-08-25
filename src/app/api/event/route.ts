import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Strictly typed — browser cannot send any other event_type through this endpoint.
// opened / began / answered / submitted keep their existing dedicated routes.
const CLICK_EVENTS = ["mkl_logo_clicked", "booth_clicked", "vip_clicked", "intro_replayed"] as const;

const BodySchema = z.object({
  slug: z.string().min(1).max(200),
  event_type: z.enum(CLICK_EVENTS),
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

  const { slug, event_type } = parsed.data;
  const supabase = createClient();

  // Resolve instance server-side — never trust the browser with instance IDs.
  const { data: instance } = await supabase
    .from("survey_instances")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!instance) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Click events are valid before AND after submission (respondent may click
  // the logo or promo tiles at any point), so submitted_at is not checked.
  const { error } = await supabase.from("survey_events").insert({
    survey_instance_id: instance.id,
    event_type,
  });

  if (error) {
    return Response.json({ error: "Failed to record event" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
