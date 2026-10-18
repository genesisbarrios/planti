/**
 * Last model-call status for the Settings diagnostics panel. Process-local and
 * never contains prompts, outputs or keys: only what is needed to see whether
 * the integration works.
 */
export type ModelCallRecord = {
  at: string;
  model: string;
  ok: boolean;
  reason?: string;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
};

// Next.js bundles route handlers and pages separately, so a module-level
// variable would not be shared between them; globalThis is, per process.
const store = globalThis as typeof globalThis & { __plantiLastModelCall?: ModelCallRecord };

export function recordModelCall(record: ModelCallRecord) {
  store.__plantiLastModelCall = record;
}

export function lastModelCall(): ModelCallRecord | null {
  return store.__plantiLastModelCall ?? null;
}
