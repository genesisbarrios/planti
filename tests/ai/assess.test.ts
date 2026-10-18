import { describe, expect, it, vi } from "vitest";
import { assessWithModel, type ModelConfig } from "@/lib/ai/assess";
import { parseModelAssessment } from "@/lib/ai/schemas";

const config: ModelConfig = { apiKey: "test-key", baseUrl: "https://example.test/v1/", model: "nvidia/test-model", thinking: true, timeoutMs: 200 };

const valid = {
  assessment: "Moisture is declining steadily since the last watering.",
  observed_facts: ["Latest moisture is 41.2%", "Trend is declining at -0.45 points per hour"],
  interpretation: "The soil may be drying at a typical rate for indoor conditions; this is an interpretation.",
  recommended_action: "Check the top few centimetres of soil by hand this evening.",
  reasons: ["The calculated trend is a clear decline."],
  confidence: "medium",
  limitations: ["Only one drying cycle observed."],
  follow_up_observation: "Readings over the next 12 hours will show whether the decline continues.",
  needs_more_data: false,
};

function completion(content: string, extra: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      model: "nvidia/test-model",
      choices: [{ message: { content }, finish_reason: "stop" }],
      usage: { prompt_tokens: 900, completion_tokens: 300, completion_tokens_details: { reasoning_tokens: 120 } },
      ...extra,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("parseModelAssessment", () => {
  it("accepts a valid object, including inside code fences", () => {
    expect(parseModelAssessment(JSON.stringify(valid)).ok).toBe(true);
    expect(parseModelAssessment("```json\n" + JSON.stringify(valid) + "\n```").ok).toBe(true);
  });

  it("rejects empty, non-JSON and schema-violating output", () => {
    expect(parseModelAssessment("")).toMatchObject({ ok: false, error: "empty" });
    expect(parseModelAssessment("The plant looks fine.")).toMatchObject({ ok: false, error: "not_json" });
    expect(parseModelAssessment("{ not json }")).toMatchObject({ ok: false, error: "not_json" });
    expect(parseModelAssessment(JSON.stringify({ ...valid, confidence: "very high" }))).toMatchObject({ ok: false, error: "schema" });
    const missing: Partial<typeof valid> = { ...valid };
    delete missing.recommended_action;
    expect(parseModelAssessment(JSON.stringify(missing))).toMatchObject({ ok: false, error: "schema" });
    expect(parseModelAssessment(JSON.stringify({ ...valid, observed_facts: [] }))).toMatchObject({ ok: false, error: "schema" });
  });
});

describe("assessWithModel", () => {
  it("returns validated output and sends only server-side credentials", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => completion(JSON.stringify(valid)));
    const result = await assessWithModel({ evidence: { calculated: { trend: "declining" } }, calculatedConfidence: "high", config, fetchImpl });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.recommended_action).toBe(valid.recommended_action);
      expect(result.confidenceCapped).toBe(false);
      expect(result.meta.usage?.promptTokens).toBe(900);
    }
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://example.test/v1/chat/completions");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe("nvidia/test-model");
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.response_format.json_schema.schema.required).toContain("recommended_action");
    expect(body.messages[0].role).toBe("system");
  });

  it("caps model confidence at the calculated confidence", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => completion(JSON.stringify({ ...valid, confidence: "high" })));
    const result = await assessWithModel({ evidence: {}, calculatedConfidence: "low", config, fetchImpl });
    expect(result.ok && result.output.confidence).toBe("low");
    expect(result.ok && result.confidenceCapped).toBe(true);
  });

  it("reports malformed output as a failure, never as an assessment", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => completion("I think the plant needs water!"));
    expect(await assessWithModel({ evidence: {}, calculatedConfidence: "medium", config, fetchImpl })).toMatchObject({ ok: false, reason: "not_json" });
  });

  it("reports schema violations", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => completion(JSON.stringify({ assessment: "ok" })));
    expect(await assessWithModel({ evidence: {}, calculatedConfidence: "medium", config, fetchImpl })).toMatchObject({ ok: false, reason: "schema" });
  });

  it("reports provider HTTP errors", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("upstream down", { status: 503 }));
    expect(await assessWithModel({ evidence: {}, calculatedConfidence: "medium", config, fetchImpl })).toMatchObject({ ok: false, reason: "http", detail: "HTTP 503" });
  });

  it("reports network failures", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await assessWithModel({ evidence: {}, calculatedConfidence: "medium", config, fetchImpl })).toMatchObject({ ok: false, reason: "network" });
  });

  it("times out a hanging provider", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
        }),
    );
    // Both the reasoning attempt and the no-reasoning retry hang.
    const result = await assessWithModel({ evidence: {}, calculatedConfidence: "medium", config: { ...config, timeoutMs: 20 }, fetchImpl });
    expect(result).toMatchObject({ ok: false, meta: { retriedWithoutReasoning: true } });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("retries once without reasoning when reasoning runs out of budget, and says so", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '{"assessment": "par' }, finish_reason: "length" }] }), { status: 200 }))
      .mockResolvedValueOnce(completion(JSON.stringify(valid)));
    const result = await assessWithModel({ evidence: {}, calculatedConfidence: "medium", config, fetchImpl });
    expect(result.ok).toBe(true);
    expect(result.meta).toMatchObject({ retriedWithoutReasoning: true, thinking: false });
    expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body)).chat_template_kwargs).toEqual({ enable_thinking: false });
  });

  it("reports a reasoning model that ran out of budget before answering", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "" }, finish_reason: "length" }] }), { status: 200 }),
    );
    const result = await assessWithModel({ evidence: {}, calculatedConfidence: "medium", config, fetchImpl });
    expect(result).toMatchObject({ ok: false, reason: "truncated", meta: { retriedWithoutReasoning: true } });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
