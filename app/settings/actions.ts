"use server";

import { callModel } from "@/lib/ai/nebius";
import { requireUser } from "@/lib/auth";
import { isConfigured, nebiusEnv } from "@/lib/env";
import { createRateLimiter } from "@/lib/rate-limit";

export type ModelTestResult = { model: string; ok: boolean; detail: string };
export type ModelTestState = { results?: ModelTestResult[]; error?: string };

const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });

/** Sends a tiny JSON request to each configured model to confirm it responds. */
export async function testModelsAction(): Promise<ModelTestState> {
  const user = await requireUser();
  if (!limiter.check(user.id).allowed) return { error: "Too many tests. Wait a minute." };
  if (!isConfigured("nebius")) return { error: "Nebius is not configured." };

  const env = nebiusEnv();
  const models = [env.model, env.comparisonModel].filter((m): m is string => Boolean(m));
  const results = await Promise.all(
    models.map(async (model): Promise<ModelTestResult> => {
      const r = await callModel({
        apiKey: env.apiKey,
        baseUrl: env.baseUrl,
        model,
        thinking: false,
        maxTokens: 64,
        timeoutMs: 30_000,
        messages: [
          { role: "system", content: "Reply with JSON only." },
          { role: "user", content: 'Return {"ok": true}' },
        ],
      });
      if (!r.ok) return { model, ok: false, detail: r.status ? `${r.error} (HTTP ${r.status})` : r.error };
      const valid = /"ok"\s*:\s*true/.test(r.content);
      return { model: r.model, ok: valid, detail: valid ? `Responded in ${r.latencyMs} ms` : "Responded, but not with the expected JSON" };
    }),
  );
  return { results };
}
