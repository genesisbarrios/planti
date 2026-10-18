import { describe, expect, it } from "vitest";
import { analyzePlant } from "@/lib/analysis/analyze";
import { generateScenario, isScenarioId, SCENARIOS, type ScenarioId } from "@/lib/simulation/scenarios";

const end = new Date("2026-10-18T12:00:00.000Z");

/** Runs a simulated timeline through the same analysis used for live data. */
function analyzeScenario(scenario: ScenarioId) {
  const timeline = generateScenario(scenario, { end, seed: 20261018 });
  return analyzePlant({
    readings: timeline.readings.map((r) => ({ ...r, source: "simulated" })),
    careEvents: timeline.careEvents.map((e, i) => ({ id: `e${i}`, eventType: e.eventType, occurredAt: e.occurredAt })),
    now: end,
  });
}

describe("simulation scenarios", () => {
  it("is repeatable for the same seed", () => {
    for (const id of Object.keys(SCENARIOS) as ScenarioId[]) {
      expect(generateScenario(id, { end, seed: 7 })).toEqual(generateScenario(id, { end, seed: 7 }));
    }
  });

  it("differs for different seeds", () => {
    const a = generateScenario("gradual_decline", { end, seed: 1 }).readings.map((r) => r.soilMoisturePercent);
    const b = generateScenario("gradual_decline", { end, seed: 2 }).readings.map((r) => r.soilMoisturePercent);
    expect(a).not.toEqual(b);
  });

  it("produces ordered readings within valid ranges", () => {
    const { readings } = generateScenario("noisy", { end, hours: 24, intervalMinutes: 30 });
    expect(readings).toHaveLength(49);
    expect(readings.at(-1)?.recordedAt).toBe(end.toISOString());
    for (let i = 1; i < readings.length; i++) expect(readings[i].recordedAt > readings[i - 1].recordedAt).toBe(true);
    for (const r of readings) {
      expect(r.soilMoisturePercent).toBeGreaterThanOrEqual(0);
      expect(r.soilMoisturePercent).toBeLessThanOrEqual(100);
    }
  });

  it("validates scenario ids", () => {
    expect(isScenarioId("stable")).toBe(true);
    expect(isScenarioId("toString")).toBe(false);
    expect(isScenarioId(undefined)).toBe(false);
  });
});

describe("scenarios through the analysis engine", () => {
  it("gradual_decline → declining with a drying rate", () => {
    const s = analyzeScenario("gradual_decline");
    expect(s.trend).toBe("declining");
    expect(s.estimatedChangePercentPerHour!).toBeCloseTo(-0.45, 1);
    expect(s.confidence).toBe("high");
  });

  it("watering_response → declining since watering, with an observed increase", () => {
    const s = analyzeScenario("watering_response");
    expect(s.trend).toBe("declining");
    expect(s.interventions).toHaveLength(1);
    expect(s.interventions[0].outcome).toBe("moisture_increase_observed");
    expect(s.trendSegmentStart).not.toBeNull();
  });

  it("stable → stable, no drying rate", () => {
    const s = analyzeScenario("stable");
    expect(s.trend).toBe("stable");
    expect(s.estimatedChangePercentPerHour).toBeNull();
  });

  it("noisy → no confident trend", () => {
    const s = analyzeScenario("noisy");
    expect(s.confidence).toBe("low");
    expect(s.estimatedChangePercentPerHour).toBeNull();
  });

  it("stale → stale data, low confidence", () => {
    const s = analyzeScenario("stale");
    expect(s.dataFreshness).toBe("stale");
    expect(s.freshnessAgeMinutes).toBe(360);
    expect(s.confidence).toBe("low");
  });
});
