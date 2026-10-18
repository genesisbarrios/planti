import { describe, expect, it } from "vitest";
import { generateContinuation, medianIntervalMinutes } from "@/lib/simulation/fast-forward";

const start = new Date("2026-10-18T06:00:00.000Z");
const end = new Date("2026-10-18T12:00:00.000Z");

describe("generateContinuation", () => {
  it("fills the range at the given cadence, ending exactly at the end", () => {
    const r = generateContinuation({ start, end, startMoisture: 40, dryingPerHour: 0.45, wateringAt: null, intervalMinutes: 30, seed: 1 });
    expect(r).toHaveLength(12);
    expect(r[0].recordedAt).toBe("2026-10-18T06:30:00.000Z");
    expect(r.at(-1)?.recordedAt).toBe(end.toISOString());
  });

  it("keeps drying without watering", () => {
    const r = generateContinuation({ start, end, startMoisture: 40, dryingPerHour: 0.45, wateringAt: null, intervalMinutes: 30, seed: 1 });
    expect(r.at(-1)!.soilMoisturePercent).toBeLessThan(40);
  });

  it("rises over the hour after watering, then dries again", () => {
    const r = generateContinuation({ start, end, startMoisture: 40, dryingPerHour: 0.45, wateringAt: start, intervalMinutes: 30, seed: 1 });
    const peak = Math.max(...r.map((x) => x.soilMoisturePercent));
    expect(peak).toBeGreaterThan(60);
    expect(r.at(-1)!.soilMoisturePercent).toBeLessThan(peak);
  });

  it("is deterministic for a seed", () => {
    const a = generateContinuation({ start, end, startMoisture: 40, dryingPerHour: 0.45, wateringAt: start, intervalMinutes: 30, seed: 9 });
    const b = generateContinuation({ start, end, startMoisture: 40, dryingPerHour: 0.45, wateringAt: start, intervalMinutes: 30, seed: 9 });
    expect(a).toEqual(b);
  });
});

describe("medianIntervalMinutes", () => {
  it("finds the typical spacing and falls back when unknown", () => {
    const ts = ["2026-10-18T10:00:00Z", "2026-10-18T10:15:00Z", "2026-10-18T10:30:00Z", "2026-10-18T11:30:00Z"];
    expect(medianIntervalMinutes(ts)).toBe(15);
    expect(medianIntervalMinutes(["2026-10-18T10:00:00Z"])).toBe(30);
  });
});
