import type { InterventionOutcomeKind } from "@/lib/types/domain";
import type { AnalysisConfig } from "./config";
import { compareAroundEvent } from "./intervention";
import type { MoisturePoint } from "./readings";

export type WateringRef = { id: string; occurredAt: string };
export type ExistingOutcome = { id: string; careEventId: string | null; outcome: InterventionOutcomeKind; assessmentId?: string | null };
export type AssessmentRef = { id: string; createdAt: string };

export type OutcomeRow = {
  care_event_id: string;
  assessment_id: string | null;
  observed_at: string;
  observation_window_minutes: number;
  before_summary: Record<string, unknown>;
  after_summary: Record<string, unknown>;
  outcome: InterventionOutcomeKind;
  explanation: string;
};

export type OutcomeAction =
  | { kind: "insert"; row: OutcomeRow }
  | { kind: "update"; id: string; row: OutcomeRow };

/** How long before a care event an assessment still counts as "the recommendation it followed". */
const ASSESSMENT_LINK_HOURS = 48;

/**
 * Decides which intervention outcomes to create or update. Pure: the caller
 * loads the data and applies the actions.
 *
 * - Every watering gets an outcome record as soon as it is logged.
 * - Pending outcomes are re-evaluated as readings arrive.
 * - Final outcomes (anything other than pending) are never recomputed, so the
 *   record of what was observed at the time is stable.
 */
export function planOutcomes(input: {
  waterings: WateringRef[];
  existing: ExistingOutcome[];
  points: MoisturePoint[];
  assessments: AssessmentRef[];
  now: Date;
  config: AnalysisConfig;
}): OutcomeAction[] {
  const { waterings, existing, points, assessments, now, config } = input;
  const byEvent = new Map(existing.filter((o) => o.careEventId).map((o) => [o.careEventId!, o]));
  const actions: OutcomeAction[] = [];

  for (const w of waterings) {
    const current = byEvent.get(w.id);
    if (current && current.outcome !== "pending_observation") continue;

    const c = compareAroundEvent(points, w.occurredAt, now, config);
    if (current && c.outcome === "pending_observation") continue; // nothing new yet

    const eventMs = Date.parse(w.occurredAt);
    const preceding = assessments
      .filter((a) => {
        const t = Date.parse(a.createdAt);
        return t <= eventMs && eventMs - t <= ASSESSMENT_LINK_HOURS * 3_600_000;
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];

    const row: OutcomeRow = {
      care_event_id: w.id,
      // Once linked, an outcome keeps the recommendation it followed.
      assessment_id: current?.assessmentId ?? preceding?.id ?? null,
      // A pending outcome is dated at the event; a final one where the response was observed.
      observed_at: c.outcome === "pending_observation" ? w.occurredAt : c.after.windowStart,
      observation_window_minutes: c.observationWindowMinutes,
      before_summary: { ...c.before, threshold_points: c.thresholdPoints },
      after_summary: { ...c.after, change_points: c.changePoints },
      outcome: c.outcome,
      explanation: c.explanation,
    };
    actions.push(current ? { kind: "update", id: current.id, row } : { kind: "insert", row });
  }
  return actions;
}
