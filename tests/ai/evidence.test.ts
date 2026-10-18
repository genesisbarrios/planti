import { describe, expect, it } from "vitest";
import { buildEvidence, EVIDENCE_LIMITS, evidenceFingerprint, summarizeHistory } from "@/lib/ai/evidence";
import { deterministicFallback } from "@/lib/ai/fallback";
import { analyzePlant } from "@/lib/analysis/analyze";
import { buildNarrative } from "@/lib/memory/narrative";
import { generateScenario } from "@/lib/simulation/scenarios";
import type { CareEvent, Plant, SensorReading } from "@/lib/types/domain";

const NOW = new Date("2026-10-18T12:00:00.000Z");

const plant: Plant = {
  id: "p1",
  name: "Monstera",
  species: null,
  location: "Living room",
  lightConditions: null,
  potNotes: null,
  carePreferences: { watering: "When the top 3 cm are dry" },
  plantedAt: null,
  notes: "x".repeat(2000),
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
};

function scenario(id: Parameters<typeof generateScenario>[0], intervalMinutes = 30) {
  const t = generateScenario(id, { end: NOW, seed: 20261018, intervalMinutes });
  const readings: SensorReading[] = t.readings.map((r, i) => ({
    id: i + 1,
    plantId: "p1",
    deviceId: null,
    recordedAt: r.recordedAt,
    temperatureC: r.temperatureC,
    soilMoistureRaw: null,
    soilMoisturePercent: r.soilMoisturePercent,
    soilMoistureStatus: r.soilMoistureStatus,
    source: "simulated",
  }));
  const careEvents: CareEvent[] = t.careEvents.map((e, i) => ({ id: `c${i}`, plantId: "p1", eventType: e.eventType, occurredAt: e.occurredAt, amountMl: e.amountMl, notes: null }));
  return { readings, careEvents, analysis: analyzePlant({ readings, careEvents, now: NOW }) };
}

describe("buildEvidence", () => {
  it("bounds history to hourly medians instead of sending every reading", () => {
    const { readings } = scenario("gradual_decline", 5); // 865 readings
    const history = summarizeHistory(readings, NOW);
    expect(readings.length).toBeGreaterThan(800);
    expect(history.length).toBeLessThanOrEqual(EVIDENCE_LIMITS.maxHistoryPoints);
    expect(history.every((h) => h.readings >= 1)).toBe(true);
  });

  it("carries the deterministic analysis, labels sources, and clips free text", () => {
    const { readings, careEvents, analysis } = scenario("watering_response");
    const evidence = buildEvidence({ plant, analysis, readings, careEvents, priorAssessments: [], now: NOW });
    expect(evidence.calculated.trend).toBe(analysis.trend);
    expect(evidence.calculated.confidence).toBe(analysis.confidence);
    expect(evidence.sources).toEqual(["simulated"]);
    expect(evidence.plant.species).toBe("unknown");
    expect(evidence.plant.notes!.length).toBeLessThanOrEqual(EVIDENCE_LIMITS.maxTextChars + 1);
    expect(evidence.calculated.responses_after_watering[0].outcome).toBe("moisture_increase_observed");
    expect(JSON.stringify(evidence).length).toBeLessThan(12_000);
  });

  it("changes the fingerprint when a new reading or care event arrives", () => {
    const { readings, careEvents } = scenario("watering_response");
    const a = evidenceFingerprint({ plant, readings, careEvents });
    const b = evidenceFingerprint({ plant, readings: [...readings, { ...readings.at(-1)!, id: 9999, recordedAt: NOW.toISOString() }], careEvents });
    const c = evidenceFingerprint({ plant, readings, careEvents: [{ ...careEvents[0], id: "new" }, ...careEvents] });
    expect(new Set([a, b, c]).size).toBe(3);
    expect(evidenceFingerprint({ plant, readings, careEvents })).toBe(a);
  });
});

describe("deterministicFallback", () => {
  it("suggests checking the device when data is stale", () => {
    const { analysis } = scenario("stale");
    const fb = deterministicFallback(analysis, buildNarrative(analysis, NOW));
    expect(fb.recommendedAction).toMatch(/power and Wi-Fi/);
    expect(fb.confidence).toBe("low");
  });

  it("builds a declining-trend fallback from calculations only, without inventing thresholds", () => {
    const { analysis } = scenario("gradual_decline");
    const fb = deterministicFallback(analysis, buildNarrative(analysis, NOW));
    expect(fb.reasons[0]).toMatch(/0\.4\d points per hour/);
    expect(fb.recommendedAction).not.toMatch(/\d+%/);
    expect(fb.assessment).toMatch(/simulated/);
  });

  it("asks for more data when there is not enough", () => {
    const analysis = analyzePlant({ readings: [], careEvents: [], now: NOW });
    expect(deterministicFallback(analysis, buildNarrative(analysis, NOW)).recommendedAction).toMatch(/readings/);
  });
});
