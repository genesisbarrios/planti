import type { Confidence } from "@/lib/types/domain";
import { callModel, type ModelUsage } from "./nebius";
import { buildUserMessage, PLANTI_SYSTEM_PROMPT } from "./prompts";
import { z } from "zod";
import { modelAssessmentSchema, parseModelAssessment, type ModelAssessment } from "./schemas";

export type ModelConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  thinking: boolean;
  timeoutMs?: number;
  maxTokens?: number;
};

export type CallMeta = {
  model: string;
  /** Total time across attempts. */
  latencyMs: number;
  usage: ModelUsage | null;
  /** Whether the accepted (or last) attempt used reasoning. */
  thinking: boolean;
  /** True when a reasoning attempt ran out of budget or time and was retried without reasoning. */
  retriedWithoutReasoning: boolean;
};

export type AssessOutcome =
  | { ok: true; output: ModelAssessment; confidenceCapped: boolean; meta: CallMeta }
  | { ok: false; reason: "timeout" | "network" | "http" | "bad_response" | "truncated" | "empty" | "not_json" | "schema"; detail?: string; meta: CallMeta };

const RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

/** The same contract the reply is validated against, sent for constrained decoding. */
const ASSESSMENT_JSON_SCHEMA = { name: "planti_assessment", schema: z.toJSONSchema(modelAssessmentSchema) as Record<string, unknown> };

/**
 * Sends the evidence to the model and accepts only schema-valid output.
 * The model's confidence is capped at the deterministic confidence: the model
 * may be less sure than the calculations, never more.
 */
export async function assessWithModel(input: {
  evidence: unknown;
  calculatedConfidence: Confidence;
  config: ModelConfig;
  fetchImpl?: typeof fetch;
}): Promise<AssessOutcome> {
  const { config } = input;
  const attempt = (thinking: boolean, timeoutMs: number) =>
    callModel({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      thinking,
      timeoutMs,
      // Measured Lightning reasoning used ~3.9k–6.5k completion tokens.
      maxTokens: config.maxTokens ?? 10_000,
      temperature: 0.2,
      jsonSchema: ASSESSMENT_JSON_SCHEMA,
      messages: [
        { role: "system", content: PLANTI_SYSTEM_PROMPT },
        { role: "user", content: buildUserMessage(input.evidence) },
      ],
      fetchImpl: input.fetchImpl,
    });

  let call = await attempt(config.thinking, config.timeoutMs ?? 75_000);
  let latencyMs = call.latencyMs;
  let thinking = config.thinking;
  let retriedWithoutReasoning = false;
  // Reasoning length varies run to run. One fast retry without reasoning
  // (still schema-constrained, still confidence-capped) beats a fallback.
  if (!call.ok && thinking && (call.error === "truncated" || call.error === "timeout")) {
    call = await attempt(false, Math.min(30_000, config.timeoutMs ?? 30_000));
    latencyMs += call.latencyMs;
    thinking = false;
    retriedWithoutReasoning = true;
  }

  if (!call.ok) {
    return {
      ok: false,
      reason: call.error,
      detail: call.status ? `HTTP ${call.status}` : undefined,
      meta: { model: call.model, latencyMs, usage: null, thinking, retriedWithoutReasoning },
    };
  }
  const meta: CallMeta = { model: call.model, latencyMs, usage: call.usage, thinking, retriedWithoutReasoning };
  const parsed = parseModelAssessment(call.content);
  if (!parsed.ok) return { ok: false, reason: parsed.error, detail: parsed.detail, meta };

  const capped = RANK[parsed.value.confidence] > RANK[input.calculatedConfidence];
  return {
    ok: true,
    output: capped ? { ...parsed.value, confidence: input.calculatedConfidence } : parsed.value,
    confidenceCapped: capped,
    meta,
  };
}
