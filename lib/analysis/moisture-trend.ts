import type { AnalysisConfig } from "./config";
import { median, spanHours, type MoisturePoint } from "./readings";

export type TrendDirection = "declining" | "rising" | "stable" | "unclear" | "insufficient_data";

export type TrendEstimate = {
  trend: TrendDirection;
  sampleCount: number;
  spanHours: number;
  /** Least-squares slope in % points per hour; null when not estimable. */
  slopePerHour: number | null;
  /** Goodness of fit of the linear model (0–1); null when not estimable. */
  rSquared: number | null;
  /** Standard deviation of residuals around the fit, in % points. */
  residualSd: number | null;
};

type Fit = { slope: number; intercept: number; rSquared: number; residualSd: number };

/** Ordinary least squares of moisture against time (hours). */
export function linearFit(points: MoisturePoint[]): Fit | null {
  const n = points.length;
  if (n < 2) return null;
  const t0 = points[0].t;
  const xs = points.map((p) => (p.t - t0) / 3_600_000);
  const ys = points.map((p) => p.moisture);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i] - meanX) ** 2;
    sxy += (xs[i] - meanX) * (ys[i] - meanY);
    syy += (ys[i] - meanY) ** 2;
  }
  if (sxx === 0) return null;

  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;
  let ssRes = 0;
  for (let i = 0; i < n; i++) ssRes += (ys[i] - (intercept + slope * xs[i])) ** 2;
  // A perfectly flat series has no variance to explain; treat the fit as exact.
  const rSquared = syy === 0 ? 1 : Math.max(0, 1 - ssRes / syy);
  const residualSd = Math.sqrt(ssRes / Math.max(1, n - 2));
  return { slope, intercept, rSquared, residualSd };
}

/**
 * Classifies the moisture trend of a single uninterrupted segment (callers
 * should not pass readings that span a watering event). Returns
 * insufficient_data rather than guessing when there are too few readings or
 * too short a span.
 */
export function estimateTrend(points: MoisturePoint[], config: AnalysisConfig): TrendEstimate {
  const span = spanHours(points);
  const base = { sampleCount: points.length, spanHours: round(span, 2) };

  if (points.length < config.minSamples || span < config.minSpanHours) {
    return { ...base, trend: "insufficient_data", slopePerHour: null, rSquared: null, residualSd: null };
  }

  const fit = linearFit(points);
  if (!fit) return { ...base, trend: "insufficient_data", slopePerHour: null, rSquared: null, residualSd: null };

  const stats = { slopePerHour: round(fit.slope, 3), rSquared: round(fit.rSquared, 3), residualSd: round(fit.residualSd, 2) };
  // The total change explained by the slope must stand out from the noise,
  // otherwise "flat" and "noisy" would be indistinguishable.
  const changeOverSpan = Math.abs(fit.slope) * span;
  if (Math.abs(fit.slope) < config.stableSlopePerHour && changeOverSpan < Math.max(2, 2 * fit.residualSd)) {
    return { ...base, ...stats, trend: fit.residualSd > 3 ? "unclear" : "stable" };
  }
  if (fit.rSquared < config.minTrendRSquared) return { ...base, ...stats, trend: "unclear" };
  return { ...base, ...stats, trend: fit.slope < 0 ? "declining" : "rising" };
}

/**
 * Drying rate (% points per hour, negative) only when the segment shows a
 * clear decline; null otherwise. Never extrapolated from unclear data.
 */
export function estimateDryingRate(estimate: TrendEstimate): number | null {
  return estimate.trend === "declining" ? estimate.slopePerHour : null;
}

export type SuddenChange = {
  direction: "rise" | "drop";
  /** Time of the last reading before the change began. */
  startedAt: string;
  /** Time of the reading where the change peaked. */
  endedAt: string;
  fromPercent: number;
  toPercent: number;
  deltaPoints: number;
};

/**
 * Robust estimate of sensor noise (standard deviation, % points) from the
 * median absolute difference between consecutive readings. Rare jumps such as
 * watering barely affect it.
 */
export function estimateNoiseSd(points: MoisturePoint[]): number {
  if (points.length < 3) return 0;
  const diffs: number[] = [];
  for (let i = 1; i < points.length; i++) diffs.push(Math.abs(points[i].moisture - points[i - 1].moisture));
  return (median(diffs) ?? 0) / 0.6745 / Math.SQRT2;
}

/**
 * Sustained moisture changes, e.g. watering or the sensor being moved. The
 * level before a reading (median of the lookback window) is compared with the
 * level of that reading and the next two (their median), so a single noisy
 * spike that falls back is not a change. The threshold grows with the
 * sensor's own noise. Changes at the very end of the data are not reported
 * until enough later readings confirm them.
 */
export function detectSuddenChanges(points: MoisturePoint[], config: AnalysisConfig): SuddenChange[] {
  const lookbackMs = config.suddenChangeLookbackMinutes * 60_000;
  const threshold = Math.max(config.suddenChangePoints, 3 * estimateNoiseSd(points));
  const changes: SuddenChange[] = [];

  let i = 1;
  while (i + 2 < points.length) {
    const cur = points[i];
    const before = points.slice(0, i).filter((p) => cur.t - p.t <= lookbackMs);
    const next = points.slice(i, i + 3);
    if (before.length < 2 || next[2].t - cur.t > lookbackMs) {
      i++;
      continue;
    }
    const baseLevel = median(before.map((p) => p.moisture))!;
    const newLevel = median(next.map((p) => p.moisture))!;
    const delta = newLevel - baseLevel;
    if (Math.abs(delta) < threshold) {
      i++;
      continue;
    }

    const direction = delta > 0 ? "rise" : "drop";
    const further = (a: number, b: number) => (direction === "rise" ? a > b : a < b);
    // Follow the change until the three-reading level stops moving the same way.
    let end = i;
    let level = newLevel;
    while (end + 3 < points.length) {
      const nextLevel = median(points.slice(end + 1, end + 4).map((p) => p.moisture))!;
      if (!further(nextLevel, level)) break;
      end++;
      level = nextLevel;
    }
    const peak = points.slice(i, end + 3).reduce((best, p) => (further(p.moisture, best.moisture) ? p : best));
    changes.push({
      direction,
      startedAt: new Date(points[i - 1].t).toISOString(),
      endedAt: new Date(peak.t).toISOString(),
      fromPercent: round(baseLevel, 1),
      toPercent: round(level, 1),
      deltaPoints: round(level - baseLevel, 1),
    });
    // Skip past the change so it is reported once.
    const resumeAfter = peak.t + lookbackMs;
    while (i < points.length && points[i].t <= resumeAfter) i++;
  }
  return changes;
}

function round(value: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
