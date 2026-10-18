import { describe, expect, it } from "vitest";
import { analyzePlant } from "@/lib/analysis/analyze";
import { buildNarrative } from "@/lib/memory/narrative";
import { buildTimeline } from "@/lib/memory/timeline";
import { generateScenario, type ScenarioId } from "@/lib/simulation/scenarios";
import { hoursAgo, NOW, series } from "../analysis/helpers";

function scenarioSummary(id: ScenarioId) {
  const t = generateScenario(id, { end: NOW, seed: 20261018 });
  const careEvents = t.careEvents.map((e, i) => ({ id: `c${i}`, plantId: "p", eventType: e.eventType, occurredAt: e.occurredAt, amountMl: e.amountMl, notes: null }));
  const summary = analyzePlant({ readings: t.readings.map((r) => ({ ...r, source: "simulated" })), careEvents, now: NOW });
  return { summary, careEvents };
}

describe("buildNarrative", () => {
  it("describes drying since watering and the observed rise, from evidence", () => {
    const text = buildNarrative(scenarioSummary("watering_response").summary, NOW).join(" ");
    expect(text).toMatch(/declining since the last watering 24 hours ago/);
    expect(text).toMatch(/After the watering 24 hours ago, moisture rose from about \d+% to \d+% and has gradually declined since\./);
    expect(text).toMatch(/More drying cycles are needed/);
    expect(text).toMatch(/simulated, not measured/);
  });

  it("admits insufficient data instead of describing a trend", () => {
    const summary = analyzePlant({ readings: series(4, () => 50), careEvents: [], now: NOW });
    const text = buildNarrative(summary, NOW).join(" ");
    expect(text).toMatch(/not enough to estimate a drying pattern/);
    expect(text).not.toMatch(/declining|rising|typical/);
  });

  it("handles a plant with no readings", () => {
    const summary = analyzePlant({ readings: [], careEvents: [], now: NOW });
    expect(buildNarrative(summary, NOW)).toEqual([
      "No readings yet. Planti needs moisture readings before it can describe how this plant behaves.",
    ]);
  });

  it("warns when data is stale", () => {
    const text = buildNarrative(scenarioSummary("stale").summary, NOW).join(" ");
    expect(text).toMatch(/latest reading is 6 hours old/);
  });

  it("does not claim a moisture increase that wasn't observed", () => {
    const summary = analyzePlant({
      readings: series(48, () => 45),
      careEvents: [{ id: "w", eventType: "watered", occurredAt: hoursAgo(10) }],
      now: NOW,
    });
    const text = buildNarrative(summary, NOW).join(" ");
    expect(text).toMatch(/did not change measurably/);
    expect(text).not.toMatch(/rose/);
  });

  it("does not describe noise as a moisture jump", () => {
    const { summary } = scenarioSummary("noisy");
    expect(summary.suddenChanges).toHaveLength(0);
    expect(buildNarrative(summary, NOW).join(" ")).not.toMatch(/jump/);
  });

  it("never asserts a learned baseline from a single cycle", () => {
    const text = buildNarrative(scenarioSummary("gradual_decline").summary, NOW).join(" ");
    expect(text).not.toMatch(/baseline|learned|always/i);
  });
});

describe("buildTimeline", () => {
  it("links the watering to its calculated response, newest first", () => {
    const { summary, careEvents } = scenarioSummary("watering_response");
    const entries = buildTimeline({ summary, careEvents, outcomes: [], assessments: [] });
    expect(entries.map((e) => e.kind)).toEqual(["response", "care"]);
    expect(entries[0]).toMatchObject({ title: "Moisture rose afterwards", basis: "calculated", tone: "positive" });
  });

  it("prefers a persisted outcome over a live calculation for the same event", () => {
    const { summary, careEvents } = scenarioSummary("watering_response");
    const entries = buildTimeline({
      summary,
      careEvents,
      outcomes: [{ id: "o1", plantId: "p", careEventId: "c0", observedAt: NOW.toISOString(), outcome: "moisture_increase_observed", explanation: "stored" }],
      assessments: [],
    });
    expect(entries.filter((e) => e.kind === "response")).toHaveLength(1);
    expect(entries.find((e) => e.kind === "response")?.basis).toBe("deterministic");
  });

  it("marks where readings stopped", () => {
    const { summary } = scenarioSummary("stale");
    const entries = buildTimeline({ summary, careEvents: [], outcomes: [], assessments: [] });
    expect(entries[0]).toMatchObject({ kind: "gap", title: "Readings stopped" });
  });
});
