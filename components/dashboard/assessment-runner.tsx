"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FallbackAssessment } from "@/lib/ai/fallback";

type Status =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "created" }
  | { kind: "reused" }
  | { kind: "fallback"; reason: string; fallback: FallbackAssessment }
  | { kind: "error"; message: string };

const FALLBACK_REASON: Record<string, string> = {
  model_not_configured: "The model is not configured on this server.",
  timeout: "The model took too long to respond.",
  network: "The model service could not be reached.",
  http: "The model service returned an error.",
  truncated: "The model ran out of output budget before answering.",
  empty: "The model returned an empty answer.",
  not_json: "The model's answer was not valid JSON.",
  schema: "The model's answer did not match the required format.",
  bad_response: "The model service returned an unexpected response.",
};

/** Runs a new assessment and reports what happened, including fallbacks. */
export function AssessmentRunner({ plantId }: { plantId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [, startTransition] = useTransition();

  async function run(force: boolean) {
    setStatus({ kind: "running" });
    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId, force }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) return setStatus({ kind: "error", message: "Too many assessments in a minute. Try again shortly." });
      if (!res.ok) return setStatus({ kind: "error", message: "Could not run the assessment. Try again." });
      if (body.kind === "fallback") return setStatus({ kind: "fallback", reason: body.reason, fallback: body.fallback });
      setStatus({ kind: body.kind === "reused" ? "reused" : "created" });
      startTransition(() => router.refresh());
    } catch {
      setStatus({ kind: "error", message: "Network error. Check your connection and try again." });
    }
  }

  const running = status.kind === "running";
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => run(false)}
        disabled={running}
        aria-busy={running}
        className="w-full rounded-lg bg-forest px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-forest-hover disabled:opacity-60"
      >
        {running ? "Analyzing evidence…" : "Run assessment"}
      </button>

      <div aria-live="polite" className="text-sm">
        {running ? <p className="text-ink-muted">Calculating the trend, then asking Nemotron to interpret it. This can take up to a minute.</p> : null}
        {status.kind === "created" ? <p className="text-forest">New assessment saved.</p> : null}
        {status.kind === "reused" ? (
          <p className="text-ink-muted">
            Nothing has changed since the last assessment, so Planti reused it instead of calling the model again.{" "}
            <button type="button" onClick={() => run(true)} className="font-medium text-forest underline underline-offset-2">
              Run anyway
            </button>
          </p>
        ) : null}
        {status.kind === "error" ? <p className="text-clay">{status.message}</p> : null}
        {status.kind === "fallback" ? (
          <div className="space-y-2 rounded-lg border border-amber/30 bg-amber-soft px-4 py-3">
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-amber">Deterministic fallback · not an AI assessment</p>
            <p className="text-ink">{FALLBACK_REASON[status.reason] ?? "The model was unavailable."} This summary comes only from Planti&apos;s calculations and was not saved.</p>
            <p className="leading-relaxed text-ink">{status.fallback.assessment}</p>
            <p className="text-ink">
              <span className="font-medium">Suggested next step:</span> {status.fallback.recommendedAction}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
