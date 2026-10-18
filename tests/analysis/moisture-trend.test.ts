import { describe, expect, it } from "vitest";
import { analyzePlant } from "@/lib/analysis/analyze";
import { DEFAULT_ANALYSIS_CONFIG as config } from "@/lib/analysis/config";
import { detectSuddenChanges, estimateDryingRate, estimateTrend } from "@/lib/analysis/moisture-trend";
import { cleanReadings } from "@/lib/analysis/readings";
import { hoursAgo, NOW, series } from "./helpers";

const points = (readings: ReturnType<typeof series>) => cleanReadings(readings).points;

describe("estimateTrend", () => {
  it("reports a flat series as stable", () => {
    expect(estimateTrend(points(series(48, () => 45)), config).trend).toBe("stable");
  });

  it("reports rising moisture", () => {
    const t = estimateTrend(points(series(48, (h) => 30 + 0.6 * h)), config);
    expect(t.trend).toBe("rising");
    expect(t.slopePerHour).toBeCloseTo(0.6, 2);
  });

  it("reports declining moisture and its exact drying rate", () => {
    const t = estimateTrend(points(series(48, (h) => 70 - 0.8 * h)), config);
    expect(t.trend).toBe("declining");
    expect(estimateDryingRate(t)).toBeCloseTo(-0.8, 2);
    expect(t.rSquared).toBeCloseTo(1, 3);
  });

  it("still finds a decline through moderate sensor noise", () => {
    const t = estimateTrend(points(series(96, (h) => 70 - 0.5 * h, { noiseSd: 1, seed: 3 })), config);
    expect(t.trend).toBe("declining");
    expect(t.slopePerHour!).toBeLessThan(-0.4);
    expect(t.slopePerHour!).toBeGreaterThan(-0.6);
  });

  it("calls heavy noise without a trend unclear, not a trend, and gives no drying rate", () => {
    const t = estimateTrend(points(series(48, () => 45, { noiseSd: 8, seed: 9 })), config);
    expect(["unclear", "stable"]).toContain(t.trend);
    expect(t.trend).not.toBe("declining");
    expect(estimateDryingRate(t)).toBeNull();
  });

  it("returns insufficient_data for too few readings", () => {
    const t = estimateTrend(points(series(5, (h) => 60 - h)), config);
    expect(t.trend).toBe("insufficient_data");
    expect(t.slopePerHour).toBeNull();
    expect(estimateDryingRate(t)).toBeNull();
  });

  it("returns insufficient_data for a short time span even with many readings", () => {
    const t = estimateTrend(points(series(30, (h) => 60 - h, { intervalMinutes: 5 })), config);
    expect(t.trend).toBe("insufficient_data");
  });
});

describe("cleanReadings", () => {
  it("drops missing, out-of-range and unparseable values and duplicate timestamps", () => {
    const readings = [
      { recordedAt: hoursAgo(3), soilMoisturePercent: 50 },
      { recordedAt: hoursAgo(3), soilMoisturePercent: 51 },
      { recordedAt: hoursAgo(2), soilMoisturePercent: null },
      { recordedAt: hoursAgo(1.5), soilMoisturePercent: Number.NaN },
      { recordedAt: hoursAgo(1), soilMoisturePercent: 140 },
      { recordedAt: "not a date", soilMoisturePercent: 40 },
      { recordedAt: hoursAgo(0.5), soilMoisturePercent: 48 },
    ];
    const { points: kept, discarded } = cleanReadings(readings);
    expect(kept.map((p) => p.moisture)).toEqual([50, 48]);
    expect(discarded).toBe(5);
  });
});

describe("detectSuddenChanges", () => {
  it("reports a watering rise spread over several readings as one change", () => {
    const readings = series(40, (h) => (h < 6 ? 40 : h < 7 ? 40 + 25 * (h - 6) : 65), { intervalMinutes: 15 });
    const changes = detectSuddenChanges(points(readings), config);
    expect(changes).toHaveLength(1);
    expect(changes[0].direction).toBe("rise");
    expect(changes[0].deltaPoints).toBeGreaterThanOrEqual(20);
  });

  it("does not mistake sensor noise for jumps", () => {
    const readings = series(145, (h) => 58 - 0.15 * h, { noiseSd: 7, seed: 11 });
    expect(detectSuddenChanges(points(readings), config)).toHaveLength(0);
  });

  it("does not report a single spike that falls back", () => {
    const readings = series(48, (h) => (Math.abs(h - 12) < 0.01 ? 75 : 45));
    expect(detectSuddenChanges(points(readings), config)).toHaveLength(0);
  });

  it("ignores gradual drying", () => {
    expect(detectSuddenChanges(points(series(96, (h) => 70 - 0.5 * h)), config)).toHaveLength(0);
  });
});

describe("analyzePlant", () => {
  it("estimates the trend only on readings since the last watering", () => {
    // Dries for 36 h, watered, then dries again more slowly.
    const readings = series(145, (h) => (h < 36 ? 70 - 0.8 * h : h < 37 ? 41 + 25 * (h - 36) : 66 - 0.4 * (h - 37)));
    const summary = analyzePlant({
      readings,
      careEvents: [{ id: "w1", eventType: "watered", occurredAt: hoursAgo(36) }],
      now: NOW,
    });
    expect(summary.trend).toBe("declining");
    expect(summary.estimatedChangePercentPerHour).toBeCloseTo(-0.4, 1);
    expect(summary.lastWateringAt).toBe(hoursAgo(36));
    expect(summary.dataFreshness).toBe("fresh");
  });

  it("refuses to estimate a trend right after watering, even with plenty of older data", () => {
    const readings = series(145, (h) => (h < 70 ? 70 - 0.5 * h : 65));
    const summary = analyzePlant({
      readings,
      careEvents: [{ id: "w1", eventType: "watered", occurredAt: hoursAgo(2) }],
      now: NOW,
    });
    expect(summary.trend).toBe("insufficient_data");
    expect(summary.estimatedChangePercentPerHour).toBeNull();
    expect(summary.confidence).toBe("low");
    expect(summary.limitations.join(" ")).toMatch(/since the last watering/);
  });

  it("flags stale data and caps confidence at low", () => {
    const end = new Date(NOW.getTime() - 5 * 3_600_000);
    const summary = analyzePlant({ readings: series(96, (h) => 70 - 0.5 * h, { end }), careEvents: [], now: NOW });
    expect(summary.dataFreshness).toBe("stale");
    expect(summary.freshnessAgeMinutes).toBe(300);
    expect(summary.confidence).toBe("low");
    expect(summary.limitations.join(" ")).toMatch(/300 minutes old/);
  });

  it("returns insufficient data with no readings at all", () => {
    const summary = analyzePlant({ readings: [], careEvents: [], now: NOW });
    expect(summary.trend).toBe("insufficient_data");
    expect(summary.dataFreshness).toBe("none");
    expect(summary.latestMoisturePercent).toBeNull();
  });

  it("ignores missing values without failing", () => {
    const readings = series(96, (h) => (Math.floor(h * 2) % 5 === 0 ? null : 70 - 0.5 * h));
    const summary = analyzePlant({ readings, careEvents: [], now: NOW });
    expect(summary.trend).toBe("declining");
    expect(summary.discardedReadings).toBeGreaterThan(0);
  });

  it("labels simulated history in its limitations", () => {
    const summary = analyzePlant({ readings: series(48, () => 45, { source: "simulated" }), careEvents: [], now: NOW });
    expect(summary.sources).toEqual(["simulated"]);
    expect(summary.limitations.join(" ")).toMatch(/simulated/);
  });

  it("notes an unexplained moisture jump without a logged watering", () => {
    const readings = series(96, (h) => (h < 30 ? 60 - 0.5 * h : 70 - 0.5 * (h - 30)));
    const summary = analyzePlant({ readings, careEvents: [], now: NOW });
    expect(summary.limitations.join(" ")).toMatch(/without a logged watering/);
  });
});
