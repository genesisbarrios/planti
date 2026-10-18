import type { Confidence } from "@/lib/types/domain";
import type { DataFreshness } from "./freshness";
import type { TrendEstimate } from "./moisture-trend";

export type ConfidenceInput = {
  trend: TrendEstimate;
  freshness: DataFreshness;
  /** Readings in the window that were discarded as malformed. */
  discarded: number;
  /** All readings in the window, including discarded ones. */
  total: number;
};

export type ConfidenceResult = { confidence: Confidence; reasons: string[] };

/**
 * Confidence in the calculated trend, from data quantity, time span,
 * consistency and freshness. It never exceeds what the data supports:
 * stale, insufficient or unclear data is always low.
 */
export function assessConfidence({ trend, freshness, discarded, total }: ConfidenceInput): ConfidenceResult {
  const reasons: string[] = [];

  if (freshness !== "fresh") {
    reasons.push(freshness === "none" ? "No readings available" : "Latest reading is stale");
    return { confidence: "low", reasons };
  }
  if (trend.trend === "insufficient_data") {
    reasons.push(`Only ${trend.sampleCount} readings over ${trend.spanHours} h`);
    return { confidence: "low", reasons };
  }
  if (trend.trend === "unclear") {
    reasons.push("Readings vary too much to show a consistent trend");
    return { confidence: "low", reasons };
  }

  const r2 = trend.rSquared ?? 0;
  const strong = trend.sampleCount >= 24 && trend.spanHours >= 12 && (trend.trend === "stable" || r2 >= 0.8);
  let confidence: Confidence = strong ? "high" : "medium";
  reasons.push(`${trend.sampleCount} readings over ${trend.spanHours} h`);
  if (trend.trend !== "stable") reasons.push(`Trend fit R² = ${r2}`);

  if (total > 0 && discarded / total > 0.2) {
    confidence = confidence === "high" ? "medium" : "low";
    reasons.push(`${discarded} of ${total} readings were malformed and ignored`);
  }
  return { confidence, reasons };
}
