import type { CareEventType, Confidence, ReadingSource } from "@/lib/types/domain";
import { assessConfidence } from "./confidence";
import { DEFAULT_ANALYSIS_CONFIG, type AnalysisConfig } from "./config";
import { classifyFreshness, type DataFreshness } from "./freshness";
import { compareAroundEvent, type InterventionComparison } from "./intervention";
import { detectSuddenChanges, estimateDryingRate, estimateTrend, type SuddenChange, type TrendDirection } from "./moisture-trend";
import { cleanReadings, selectWindow, type ReadingInput } from "./readings";

export type CareEventInput = { id: string; eventType: CareEventType; occurredAt: string };

export type TrendSummary = {
  analyzedAt: string;
  windowHours: number;
  /** Readings in the analysis window after discarding malformed ones. */
  sampleCount: number;
  discardedReadings: number;
  /** Start of the segment the trend was estimated on (after the last watering or jump). */
  trendSegmentStart: string | null;
  trendSampleCount: number;
  trendSpanHours: number;
  latestMoisturePercent: number | null;
  latestReadingAt: string | null;
  trend: TrendDirection;
  /** Estimated drying rate (% points per hour). Null unless a clear decline was measured. */
  estimatedChangePercentPerHour: number | null;
  rSquared: number | null;
  lastWateringAt: string | null;
  dataFreshness: DataFreshness;
  freshnessAgeMinutes: number | null;
  sources: ReadingSource[];
  suddenChanges: SuddenChange[];
  interventions: (InterventionComparison & { careEventId: string })[];
  confidence: Confidence;
  confidenceReasons: string[];
  limitations: string[];
};

/**
 * Deterministic analysis of one plant's history. Pure: same inputs, same
 * output. The language model later interprets this summary; it never
 * computes these values itself.
 */
export function analyzePlant(input: {
  readings: ReadingInput[];
  careEvents: CareEventInput[];
  now: Date;
  config?: AnalysisConfig;
}): TrendSummary {
  const config = input.config ?? DEFAULT_ANALYSIS_CONFIG;
  const now = input.now.getTime();
  const windowStart = now - config.windowHours * 3_600_000;

  const inWindowRaw = input.readings.filter((r) => {
    const t = Date.parse(r.recordedAt);
    return Number.isFinite(t) && t > windowStart && t <= now;
  });
  const { points: allPoints } = cleanReadings(input.readings);
  const { points, discarded } = cleanReadings(inWindowRaw);
  const windowPoints = selectWindow(points, now, config.windowHours);
  const latest = allPoints.filter((p) => p.t <= now).at(-1) ?? null;
  const freshness = classifyFreshness(latest ? new Date(latest.t) : null, input.now, config.staleAfterMinutes);

  const waterings = input.careEvents
    .filter((e) => e.eventType === "watered" && Number.isFinite(Date.parse(e.occurredAt)) && Date.parse(e.occurredAt) <= now)
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  const lastWatering = waterings.at(-1) ?? null;

  // Estimate the trend only on readings since the last reset: a logged
  // watering (plus settling time) or an unlogged sudden rise.
  const suddenChanges = detectSuddenChanges(windowPoints, config);
  const lastRise = suddenChanges.filter((c) => c.direction === "rise").at(-1);
  const resetCandidates = [
    lastWatering ? Date.parse(lastWatering.occurredAt) + config.settleMinutes * 60_000 : null,
    lastRise ? Date.parse(lastRise.endedAt) : null,
  ].filter((t): t is number => t !== null && t > windowStart);
  const segmentStart = resetCandidates.length ? Math.max(...resetCandidates) : null;
  const segment = segmentStart === null ? windowPoints : windowPoints.filter((p) => p.t >= segmentStart);

  const trend = estimateTrend(segment, config);
  const { confidence, reasons } = assessConfidence({
    trend,
    freshness: freshness.freshness,
    discarded,
    total: inWindowRaw.length,
  });

  const interventions = waterings
    .filter((e) => Date.parse(e.occurredAt) > windowStart)
    .slice(-3)
    .map((e) => ({ careEventId: e.id, ...compareAroundEvent(allPoints, e.occurredAt, input.now, config) }));

  const sources = [...new Set(windowPoints.map((p) => p.source).filter(Boolean))] as ReadingSource[];

  const limitations: string[] = [];
  if (freshness.freshness === "none") limitations.push("No moisture readings have been recorded.");
  if (freshness.freshness === "stale") limitations.push(`The latest reading is ${freshness.ageMinutes} minutes old, so current soil moisture is unknown.`);
  if (trend.trend === "insufficient_data" && freshness.freshness !== "none") {
    limitations.push(
      segmentStart !== null
        ? `Only ${trend.sampleCount} readings over ${trend.spanHours} h since the last watering or moisture jump; at least ${config.minSamples} readings over ${config.minSpanHours} h are needed to estimate a trend.`
        : `Only ${trend.sampleCount} readings over ${trend.spanHours} h; at least ${config.minSamples} readings over ${config.minSpanHours} h are needed to estimate a trend.`,
    );
  }
  if (trend.trend === "unclear") limitations.push("Readings are too inconsistent to identify a trend; the sensor may be noisy or conditions changed.");
  if (discarded > 0) limitations.push(`${discarded} malformed reading(s) were ignored.`);
  if (sources.includes("simulated")) limitations.push("This history includes simulated readings, not measurements.");
  if (lastRise && !waterings.some((w) => Math.abs(Date.parse(w.occurredAt) - Date.parse(lastRise.startedAt)) <= 3 * 3_600_000)) {
    limitations.push("Moisture jumped without a logged watering nearby; the cause is unknown.");
  }

  return {
    analyzedAt: input.now.toISOString(),
    windowHours: config.windowHours,
    sampleCount: windowPoints.length,
    discardedReadings: discarded,
    trendSegmentStart: segmentStart === null ? null : new Date(segmentStart).toISOString(),
    trendSampleCount: trend.sampleCount,
    trendSpanHours: trend.spanHours,
    latestMoisturePercent: latest?.moisture ?? null,
    latestReadingAt: latest ? new Date(latest.t).toISOString() : null,
    trend: trend.trend,
    estimatedChangePercentPerHour: estimateDryingRate(trend) ?? (trend.trend === "rising" ? trend.slopePerHour : null),
    rSquared: trend.rSquared,
    lastWateringAt: lastWatering?.occurredAt ?? null,
    dataFreshness: freshness.freshness,
    freshnessAgeMinutes: freshness.ageMinutes,
    sources,
    suddenChanges,
    interventions,
    confidence,
    confidenceReasons: reasons,
    limitations,
  };
}
