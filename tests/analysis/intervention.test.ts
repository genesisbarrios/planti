import { describe, expect, it } from "vitest";
import { DEFAULT_ANALYSIS_CONFIG as config } from "@/lib/analysis/config";
import { assessConfidence } from "@/lib/analysis/confidence";
import { compareAroundEvent } from "@/lib/analysis/intervention";
import { estimateTrend } from "@/lib/analysis/moisture-trend";
import { cleanReadings } from "@/lib/analysis/readings";
import { hoursAgo, NOW, series } from "./helpers";

const points = (readings: ReturnType<typeof series>) => cleanReadings(readings).points;

describe("compareAroundEvent", () => {
  it("reports an observed increase when moisture rises after watering", () => {
    // Watered 10 h ago: 40% before, ~66% after soaking in.
    const readings = series(48, (h) => (h < 14 ? 47 - 0.5 * h : h < 15 ? 40 + 26 * (h - 14) : 66 - 0.3 * (h - 15)));
    const result = compareAroundEvent(points(readings), hoursAgo(10), NOW, config);
    expect(result.outcome).toBe("moisture_increase_observed");
    expect(result.changePoints!).toBeGreaterThan(20);
    expect(result.explanation).toMatch(/observed response/);
    expect(result.explanation).not.toMatch(/caused/);
  });

  it("reports no measurable change when moisture stays flat", () => {
    const result = compareAroundEvent(points(series(48, () => 45)), hoursAgo(10), NOW, config);
    expect(result.outcome).toBe("no_measurable_change");
    expect(result.changePoints).toBe(0);
  });

  it("is pending while the observation window is still open", () => {
    const readings = series(24, () => 45);
    const result = compareAroundEvent(points(readings), hoursAgo(0.5), NOW, config);
    expect(result.outcome).toBe("pending_observation");
    expect(result.changePoints).toBeNull();
  });

  it("is inconclusive when readings stopped after the event", () => {
    const end = new Date(NOW.getTime() - 20 * 3_600_000);
    const readings = series(24, () => 45, { end });
    const result = compareAroundEvent(points(readings), hoursAgo(20.2), NOW, config);
    expect(result.outcome).toBe("inconclusive");
  });

  it("is inconclusive when there is no baseline before the event", () => {
    const readings = series(10, () => 60, { end: NOW });
    const result = compareAroundEvent(points(readings), hoursAgo(6), NOW, config);
    expect(result.outcome).toBe("inconclusive");
    expect(result.explanation).toMatch(/starting point/);
  });

  it("raises the bar for noisy sensors instead of claiming a change", () => {
    const readings = series(48, (h) => (h < 14 ? 45 : 51), { noiseSd: 6, seed: 4 });
    const result = compareAroundEvent(points(readings), hoursAgo(10), NOW, config);
    expect(result.thresholdPoints).toBeGreaterThan(config.interventionMinRisePoints);
    expect(result.outcome).not.toBe("moisture_increase_observed");
  });
});

describe("assessConfidence", () => {
  it("is high for a long, consistent, fresh decline", () => {
    const trend = estimateTrend(points(series(96, (h) => 70 - 0.5 * h)), config);
    expect(assessConfidence({ trend, freshness: "fresh", discarded: 0, total: 96 }).confidence).toBe("high");
  });

  it("is medium for a short but valid decline", () => {
    const trend = estimateTrend(points(series(16, (h) => 70 - 0.5 * h)), config);
    expect(assessConfidence({ trend, freshness: "fresh", discarded: 0, total: 16 }).confidence).toBe("medium");
  });

  it("is low for insufficient, unclear or stale data", () => {
    const short = estimateTrend(points(series(4, () => 50)), config);
    const good = estimateTrend(points(series(96, (h) => 70 - 0.5 * h)), config);
    expect(assessConfidence({ trend: short, freshness: "fresh", discarded: 0, total: 4 }).confidence).toBe("low");
    expect(assessConfidence({ trend: good, freshness: "stale", discarded: 0, total: 96 }).confidence).toBe("low");
  });

  it("downgrades when many readings were malformed", () => {
    const trend = estimateTrend(points(series(96, (h) => 70 - 0.5 * h)), config);
    expect(assessConfidence({ trend, freshness: "fresh", discarded: 40, total: 136 }).confidence).toBe("medium");
  });
});
