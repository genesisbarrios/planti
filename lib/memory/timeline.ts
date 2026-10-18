import type { TrendSummary } from "@/lib/analysis/analyze";
import type { Assessment, CareEvent, CareEventType, InterventionOutcome } from "@/lib/types/domain";

export type TimelineEntry = {
  id: string;
  at: string;
  kind: "care" | "response" | "jump" | "assessment" | "gap";
  title: string;
  detail: string | null;
  tone: "neutral" | "positive" | "caution" | "warning";
  /** Where the entry came from: persisted record or calculated from readings. */
  basis: "logged" | "calculated" | "model" | "deterministic";
};

const CARE_LABEL: Record<CareEventType, string> = {
  watered: "Watered",
  fertilized: "Fertilized",
  moved: "Moved",
  repotted: "Changed soil or pot",
  other: "Other care",
};

const RESPONSE: Record<string, { title: string; tone: TimelineEntry["tone"] }> = {
  moisture_increase_observed: { title: "Moisture rose afterwards", tone: "positive" },
  no_measurable_change: { title: "No measurable change afterwards", tone: "caution" },
  pending_observation: { title: "Waiting for readings after care", tone: "neutral" },
  inconclusive: { title: "Response unclear", tone: "neutral" },
};

/**
 * Connects care, the measured responses that followed it, unexplained jumps,
 * reporting gaps and past assessments into one reverse-chronological story.
 * Persisted outcomes take precedence over live calculations for the same event.
 */
export function buildTimeline(input: {
  summary: TrendSummary;
  careEvents: CareEvent[];
  outcomes: InterventionOutcome[];
  assessments: Assessment[];
  limit?: number;
}): TimelineEntry[] {
  const { summary, careEvents, outcomes, assessments, limit = 12 } = input;
  const entries: TimelineEntry[] = [];

  for (const e of careEvents) {
    entries.push({
      id: `care-${e.id}`,
      at: e.occurredAt,
      kind: "care",
      title: CARE_LABEL[e.eventType] + (e.amountMl != null ? ` · ${e.amountMl} ml` : ""),
      detail: e.notes,
      tone: "neutral",
      basis: "logged",
    });
  }

  const persisted = new Set(outcomes.map((o) => o.careEventId).filter(Boolean));
  for (const o of outcomes) {
    const style = RESPONSE[o.outcome];
    entries.push({ id: `outcome-${o.id}`, at: o.observedAt, kind: "response", title: style.title, detail: o.explanation, tone: style.tone, basis: "deterministic" });
  }
  for (const c of summary.interventions) {
    if (persisted.has(c.careEventId)) continue;
    const style = RESPONSE[c.outcome];
    entries.push({
      id: `calc-${c.careEventId}`,
      // Place the response where it was observed: after the soak-in window.
      at: c.outcome === "pending_observation" ? c.eventAt : c.after.windowStart,
      kind: "response",
      title: style.title,
      detail: c.explanation,
      tone: style.tone,
      basis: "calculated",
    });
  }

  for (const jump of summary.suddenChanges) {
    const nearCare = careEvents.some((e) => Math.abs(Date.parse(e.occurredAt) - Date.parse(jump.startedAt)) <= 3 * 3_600_000);
    if (nearCare) continue;
    entries.push({
      id: `jump-${jump.startedAt}`,
      at: jump.endedAt,
      kind: "jump",
      title: jump.direction === "rise" ? `Moisture jumped +${jump.deltaPoints} points` : `Moisture dropped ${jump.deltaPoints} points`,
      detail: "No care event was logged around this time, so the cause is unknown.",
      tone: "caution",
      basis: "calculated",
    });
  }

  if (summary.dataFreshness === "stale" && summary.latestReadingAt) {
    entries.push({
      id: "gap-latest",
      at: summary.latestReadingAt,
      kind: "gap",
      title: "Readings stopped",
      detail: "No reading has arrived since. Later changes in the soil are not recorded.",
      tone: "warning",
      basis: "calculated",
    });
  }

  for (const a of assessments) {
    entries.push({
      id: `assessment-${a.id}`,
      at: a.createdAt,
      kind: "assessment",
      title: `Assessment · ${a.confidence} confidence`,
      detail: a.recommendedAction ?? a.assessment,
      tone: "neutral",
      basis: a.aiModel ? "model" : "deterministic",
    });
  }

  return entries.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, limit);
}
