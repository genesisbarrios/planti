import { describe, expect, it } from "vitest";
import { DEFAULT_ANALYSIS_CONFIG as config } from "@/lib/analysis/config";
import { planOutcomes } from "@/lib/analysis/outcome-plan";
import { cleanReadings } from "@/lib/analysis/readings";
import { hoursAgo, NOW, series } from "./helpers";

// Watered 10 h ago: ~40% before, ~66% after soaking in.
const responsive = cleanReadings(series(48, (h) => (h < 14 ? 47 - 0.5 * h : h < 15 ? 40 + 26 * (h - 14) : 66 - 0.3 * (h - 15)))).points;

describe("planOutcomes", () => {
  it("creates a pending outcome as soon as watering is logged", () => {
    const points = cleanReadings(series(24, () => 45)).points;
    const actions = planOutcomes({ waterings: [{ id: "w", occurredAt: hoursAgo(0.2) }], existing: [], points, assessments: [], now: NOW, config });
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ kind: "insert", row: { care_event_id: "w", outcome: "pending_observation", observed_at: hoursAgo(0.2) } });
  });

  it("updates a pending outcome once readings show the response", () => {
    const actions = planOutcomes({
      waterings: [{ id: "w", occurredAt: hoursAgo(10) }],
      existing: [{ id: "o1", careEventId: "w", outcome: "pending_observation" }],
      points: responsive,
      assessments: [],
      now: NOW,
      config,
    });
    expect(actions).toEqual([expect.objectContaining({ kind: "update", id: "o1", row: expect.objectContaining({ outcome: "moisture_increase_observed" }) })]);
    expect(actions[0].row.explanation).toMatch(/observed response/);
  });

  it("leaves a pending outcome alone while still waiting", () => {
    const points = cleanReadings(series(24, () => 45)).points;
    const actions = planOutcomes({
      waterings: [{ id: "w", occurredAt: hoursAgo(0.5) }],
      existing: [{ id: "o1", careEventId: "w", outcome: "pending_observation" }],
      points,
      assessments: [],
      now: NOW,
      config,
    });
    expect(actions).toHaveLength(0);
  });

  it("never recomputes a final outcome", () => {
    const actions = planOutcomes({
      waterings: [{ id: "w", occurredAt: hoursAgo(10) }],
      existing: [{ id: "o1", careEventId: "w", outcome: "no_measurable_change" }],
      points: responsive,
      assessments: [],
      now: NOW,
      config,
    });
    expect(actions).toHaveLength(0);
  });

  it("keeps an existing assessment link when the outcome is re-evaluated", () => {
    const actions = planOutcomes({
      waterings: [{ id: "w", occurredAt: hoursAgo(10) }],
      existing: [{ id: "o1", careEventId: "w", outcome: "pending_observation", assessmentId: "original" }],
      points: responsive,
      assessments: [{ id: "other", createdAt: hoursAgo(11) }],
      now: NOW,
      config,
    });
    expect(actions[0].row.assessment_id).toBe("original");
  });

  it("links the assessment that preceded the watering, within 48 hours", () => {
    const actions = planOutcomes({
      waterings: [{ id: "w", occurredAt: hoursAgo(10) }],
      existing: [],
      points: responsive,
      assessments: [
        { id: "too-old", createdAt: hoursAgo(80) },
        { id: "recent", createdAt: hoursAgo(11) },
        { id: "after", createdAt: hoursAgo(2) },
      ],
      now: NOW,
      config,
    });
    expect(actions[0].row.assessment_id).toBe("recent");
  });
});
