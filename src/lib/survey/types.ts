import { z } from "zod";

export const SnapshotOptionSchema = z.object({
  id: z.string().uuid(),
  sort_order: z.number().int().nonnegative(),
  option_text: z.string(),
});

export const SnapshotQuestionSchema = z.object({
  id: z.string().uuid(),
  sort_order: z.number().int().nonnegative(),
  question_text: z.string(),
  answer_type: z.enum(["single_select", "multi_select", "free_text"]),
  required: z.boolean(),
  media_type: z.enum(["none", "image", "video"]),
  image_path: z.string().nullable(),
  video_url: z.string().nullable(),
  // Optional for backward-compat: old snapshots created before this field was added
  // are missing the field entirely; treat those as '16:9'.
  video_aspect_ratio: z.enum(["16:9", "9:16", "1:1"]).optional().default("16:9"),
  options: z.array(SnapshotOptionSchema),
});

export const SurveySnapshotSchema = z.object({
  survey_title: z.string(),
  survey_description: z.string().nullable(),
  // Optional for backward-compat: old snapshots without intro fields default to 'none'.
  intro_media_type: z.enum(["none", "image", "video"]).optional().default("none"),
  intro_image_path: z.string().nullable().optional().default(null),
  intro_video_url: z.string().nullable().optional().default(null),
  intro_video_aspect_ratio: z.enum(["16:9", "9:16", "1:1"]).optional().default("16:9"),
  questions: z.array(SnapshotQuestionSchema).min(1),
});

export type SnapshotOption = z.infer<typeof SnapshotOptionSchema>;
export type SnapshotQuestion = z.infer<typeof SnapshotQuestionSchema>;
export type SurveySnapshot = z.infer<typeof SurveySnapshotSchema>;

export interface LoadedResponse {
  question_id: string;
  answer_text: string | null;
  answer_values: string[] | null;
}
