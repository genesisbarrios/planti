import { describe, expect, it } from "vitest";
import { generateScenario } from "@/lib/simulation/scenarios";

const end = new Date("2026-10-18T12:00:00.000Z");

describe("simulation scenarios", () => {
  it("is repeatable for the same seed", () => {
    expect(generateScenario("watering_response", { end, seed: 7 })).toEqual(generateScenario("watering_response", { end, seed: 7 }));
  });

  it("differs for different seeds", () => {
    const a = generateScenario("gradual_decline", { end, seed: 1 }).readings.map((r) => r.soilMoisturePercent);
    const b = generateScenario("gradual_decline", { end, seed: 2 }).readings.map((r) => r.soilMoisturePercent);
    expect(a).not.toEqual(b);
  });

  it("produces ordered readings ending at the requested time, within valid ranges", () => {
    const { readings } = generateScenario("gradual_decline", { end, hours: 24, intervalMinutes: 30 });
    expect(readings).toHaveLength(49);
    expect(readings.at(-1)?.recordedAt).toBe(end.toISOString());
    for (let i = 1; i < readings.length; i++) expect(readings[i].recordedAt > readings[i - 1].recordedAt).toBe(true);
    for (const r of readings) {
      expect(r.soilMoisturePercent).toBeGreaterThanOrEqual(0);
      expect(r.soilMoisturePercent).toBeLessThanOrEqual(100);
    }
  });

  it("declines overall in the gradual_decline scenario", () => {
    const { readings, careEvents } = generateScenario("gradual_decline", { end });
    expect(careEvents).toHaveLength(0);
    expect(readings[0].soilMoisturePercent - readings.at(-1)!.soilMoisturePercent).toBeGreaterThan(20);
  });

  it("rises after the watering event in the watering_response scenario", () => {
    const { readings, careEvents } = generateScenario("watering_response", { end });
    expect(careEvents).toHaveLength(1);
    const wateredAt = careEvents[0].occurredAt;
    const before = readings.filter((r) => r.recordedAt <= wateredAt).at(-1)!;
    const after = readings.filter((r) => r.recordedAt > wateredAt)[3];
    expect(after.soilMoisturePercent - before.soilMoisturePercent).toBeGreaterThan(15);
  });
});
