import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assessWithModel } from "@/lib/ai/assess";
import { recordModelCall } from "@/lib/ai/diagnostics";
import { buildEvidence, evidenceFingerprint } from "@/lib/ai/evidence";
import { deterministicFallback, type FallbackAssessment } from "@/lib/ai/fallback";
import { analyzePlant, type TrendSummary } from "@/lib/analysis/analyze";
import { isConfigured, nebiusEnv } from "@/lib/env";
import { buildNarrative } from "@/lib/memory/narrative";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Assessment } from "@/lib/types/domain";
import {
  ASSESSMENT_COLUMNS,
  CARE_EVENT_COLUMNS,
  READING_COLUMNS,
  toAssessment,
  toCareEvent,
  toReading,
  type AssessmentRow,
  type CareEventRow,
  type SensorReadingRow,
} from "./mappers";
import { getOwnedPlant } from "./plants";

/** An unchanged evidence state reuses the stored assessment for this long. */
const REUSE_WINDOW_HOURS = 6;
const HISTORY_DAYS = 7;

export type AssessmentResult =
  | { kind: "created"; assessment: Assessment }
  | { kind: "reused"; assessment: Assessment }
  | { kind: "fallback"; fallback: FallbackAssessment; reason: string; analysis: TrendSummary }
  | { kind: "not_found" };

/**
 * Runs an assessment for a plant the caller owns:
 * ownership → load history → deterministic analysis → bounded evidence →
 * Nemotron via Nebius → schema validation → persist. If the model is
 * unavailable or its output is invalid, returns a labeled deterministic
 * fallback that is NOT stored as an assessment.
 */
export async function runAssessment(
  userClient: SupabaseClient,
  plantId: string,
  { force = false, now = new Date() }: { force?: boolean; now?: Date } = {},
): Promise<AssessmentResult> {
  const plant = await getOwnedPlant(userClient, plantId);
  if (!plant) return { kind: "not_found" };

  const since = new Date(now.getTime() - HISTORY_DAYS * 86_400_000).toISOString();
  const [readingsRes, careRes, priorRes] = await Promise.all([
    userClient
      .from("sensor_readings")
      .select(READING_COLUMNS)
      .eq("plant_id", plant.id)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: false })
      .limit(2000),
    userClient.from("care_events").select(CARE_EVENT_COLUMNS).eq("plant_id", plant.id).order("occurred_at", { ascending: false }).limit(50),
    userClient.from("plant_assessments").select(ASSESSMENT_COLUMNS).eq("plant_id", plant.id).order("created_at", { ascending: false }).limit(3),
  ]);
  if (readingsRes.error || careRes.error || priorRes.error) throw new Error("Could not load plant history");

  const readings = (readingsRes.data as SensorReadingRow[]).map(toReading).reverse();
  const careEvents = (careRes.data as CareEventRow[]).map(toCareEvent);
  const prior = (priorRes.data as AssessmentRow[]).map(toAssessment);
  const fingerprint = evidenceFingerprint({ plant, readings, careEvents });

  // Avoid repeating an expensive model call when nothing has changed.
  const latest = prior[0];
  if (
    !force &&
    latest?.fingerprint === fingerprint &&
    now.getTime() - Date.parse(latest.createdAt) < REUSE_WINDOW_HOURS * 3_600_000
  ) {
    return { kind: "reused", assessment: latest };
  }

  const analysis = analyzePlant({ readings, careEvents, now });
  const fallback = (reason: string): AssessmentResult => ({
    kind: "fallback",
    reason,
    analysis,
    fallback: deterministicFallback(analysis, buildNarrative(analysis, now)),
  });
  if (!isConfigured("nebius")) return fallback("model_not_configured");

  const evidence = buildEvidence({ plant, analysis, readings, careEvents, priorAssessments: prior, now });
  const env = nebiusEnv();
  const result = await assessWithModel({
    evidence,
    calculatedConfidence: analysis.confidence,
    config: { apiKey: env.apiKey, baseUrl: env.baseUrl, model: env.model, thinking: env.thinking },
  });

  recordModelCall({
    at: now.toISOString(),
    model: result.meta.model,
    ok: result.ok,
    reason: result.ok ? undefined : result.reason,
    latencyMs: result.meta.latencyMs,
    promptTokens: result.meta.usage?.promptTokens ?? null,
    completionTokens: result.meta.usage?.completionTokens ?? null,
  });
  if (!result.ok) {
    console.error("runAssessment: model call failed", result.reason, result.detail ?? "");
    return fallback(result.reason);
  }

  const { output } = result;
  // Assessments are server-written: users may read them but cannot insert,
  // so the browser can never forge a model result.
  const { data, error } = await createAdminClient()
    .from("plant_assessments")
    .insert({
      plant_id: plant.id,
      analysis_window_start: readings[0]?.recordedAt ?? null,
      analysis_window_end: readings.at(-1)?.recordedAt ?? null,
      evidence: {
        fingerprint,
        payload: evidence,
        model_output: {
          observed_facts: output.observed_facts,
          interpretation: output.interpretation,
          follow_up_observation: output.follow_up_observation,
          needs_more_data: output.needs_more_data,
        },
        call: {
          latency_ms: result.meta.latencyMs,
          usage: result.meta.usage,
          thinking: result.meta.thinking,
          retried_without_reasoning: result.meta.retriedWithoutReasoning,
          confidence_capped: result.confidenceCapped,
        },
      },
      trend_summary: analysis,
      ai_model: result.meta.model,
      assessment: output.assessment,
      recommended_action: output.recommended_action,
      confidence: output.confidence,
      reasons: output.reasons,
      limitations: output.limitations,
    })
    .select(ASSESSMENT_COLUMNS)
    .single();
  if (error || !data) {
    console.error("runAssessment: persist failed", error?.code);
    throw new Error("Could not save assessment");
  }
  return { kind: "created", assessment: toAssessment(data as AssessmentRow) };
}
