import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);

/**
 * The only shape of model output Planti accepts. Anything else is treated as
 * a failed call and never persisted.
 */
export const modelAssessmentSchema = z.object({
  assessment: text(800),
  observed_facts: z.array(text(300)).min(1).max(8),
  interpretation: text(800),
  recommended_action: text(400),
  reasons: z.array(text(300)).min(1).max(6),
  confidence: z.enum(["low", "medium", "high"]),
  limitations: z.array(text(300)).max(8),
  follow_up_observation: text(400),
  needs_more_data: z.boolean(),
});

export type ModelAssessment = z.infer<typeof modelAssessmentSchema>;

export type ParseResult =
  | { ok: true; value: ModelAssessment }
  | { ok: false; error: "empty" | "not_json" | "schema"; detail?: string };

/**
 * Extracts and validates the JSON object from a model reply. Tolerates code
 * fences or stray prose around the object, nothing more.
 */
export function parseModelAssessment(content: string | null | undefined): ParseResult {
  if (!content || !content.trim()) return { ok: false, error: "empty" };
  const unfenced = content.replace(/```(?:json)?/gi, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start < 0 || end <= start) return { ok: false, error: "not_json" };

  let json: unknown;
  try {
    json = JSON.parse(unfenced.slice(start, end + 1));
  } catch {
    return { ok: false, error: "not_json" };
  }
  const parsed = modelAssessmentSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, error: "schema", detail: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  return { ok: true, value: parsed.data };
}

export const assessmentRequestSchema = z.object({
  plantId: z.uuid(),
  /** Run a new model call even if nothing changed since the last assessment. */
  force: z.boolean().optional().default(false),
});
