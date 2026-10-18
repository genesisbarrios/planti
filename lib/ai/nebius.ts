/**
 * Minimal client for Nebius Token Factory's OpenAI-compatible Chat
 * Completions API. Server-only by usage: it needs the Nebius API key, which
 * is never sent to the browser.
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ModelCallOptions = {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Nemotron reasoning ("thinking") before answering. */
  thinking?: boolean;
  /**
   * JSON Schema the reply must follow (constrained decoding). Without it the
   * model is only asked for a JSON object, which it may shape freely.
   */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export type ModelUsage = { promptTokens: number | null; completionTokens: number | null; reasoningTokens: number | null };

export type ModelCallResult =
  | { ok: true; content: string; model: string; finishReason: string | null; usage: ModelUsage; latencyMs: number }
  | {
      ok: false;
      error: "timeout" | "network" | "http" | "bad_response" | "truncated";
      status?: number;
      model: string;
      latencyMs: number;
    };

type CompletionResponse = {
  model?: string;
  choices?: { message?: { content?: string | null }; finish_reason?: string | null }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    completion_tokens_details?: { reasoning_tokens?: number | null } | null;
  };
};

export async function callModel(options: ModelCallOptions): Promise<ModelCallResult> {
  const { apiKey, baseUrl, model, messages, maxTokens = 4096, temperature = 0.2, thinking = true, timeoutMs = 60_000 } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        response_format: options.jsonSchema
          ? { type: "json_schema", json_schema: { name: options.jsonSchema.name, schema: options.jsonSchema.schema, strict: true } }
          : { type: "json_object" },
        chat_template_kwargs: { enable_thinking: thinking },
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    const latencyMs = Date.now() - started;
    if (!response.ok) return { ok: false, error: "http", status: response.status, model, latencyMs };

    const body = (await response.json()) as CompletionResponse;
    const choice = body.choices?.[0];
    if (!choice) return { ok: false, error: "bad_response", model, latencyMs };
    // Reasoning models can exhaust the budget mid-answer; partial JSON is
    // never usable, so any length stop is a truncation.
    if (choice.finish_reason === "length") {
      return { ok: false, error: "truncated", model, latencyMs };
    }
    return {
      ok: true,
      content: choice.message?.content ?? "",
      model: body.model ?? model,
      finishReason: choice.finish_reason ?? null,
      usage: {
        promptTokens: body.usage?.prompt_tokens ?? null,
        completionTokens: body.usage?.completion_tokens ?? null,
        reasoningTokens: body.usage?.completion_tokens_details?.reasoning_tokens ?? null,
      },
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - started;
    const aborted = error instanceof Error && error.name === "AbortError";
    return { ok: false, error: aborted ? "timeout" : "network", model, latencyMs };
  } finally {
    clearTimeout(timer);
  }
}
