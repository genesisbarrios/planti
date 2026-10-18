import type { TrendSummary } from "@/lib/analysis/analyze";
import type { Confidence } from "@/lib/types/domain";

export type FallbackAssessment = {
  assessment: string;
  recommendedAction: string;
  confidence: Confidence;
  reasons: string[];
  limitations: string[];
};

/**
 * What Planti shows when the model is unavailable or its output is invalid.
 * Built only from the deterministic analysis, and always labeled as such:
 * it is never presented or stored as an AI assessment.
 */
export function deterministicFallback(summary: TrendSummary, narrative: string[]): FallbackAssessment {
  const base = { confidence: summary.confidence, limitations: summary.limitations };
  const assessment = narrative.join(" ") || "No readings are available to assess.";

  if (summary.dataFreshness === "none") {
    return { ...base, assessment, recommendedAction: "Connect the sensor or load a simulated timeline so Planti has readings to analyze.", reasons: ["There are no moisture readings for this plant."] };
  }
  if (summary.dataFreshness === "stale") {
    return {
      ...base,
      assessment,
      recommendedAction: "Check the device's power and Wi-Fi, and check the soil by hand until readings resume.",
      reasons: [`The latest reading is ${summary.freshnessAgeMinutes} minutes old.`],
    };
  }
  switch (summary.trend) {
    case "insufficient_data":
      return { ...base, assessment, recommendedAction: "Keep the sensor in place and let more readings accumulate before changing care.", reasons: ["There are not yet enough readings to estimate a trend."] };
    case "unclear":
      return { ...base, assessment, recommendedAction: "Check that the sensor is fully inserted and not touching the pot wall; readings are inconsistent.", reasons: ["Readings vary too much to show a trend."] };
    case "declining":
      return {
        ...base,
        assessment,
        recommendedAction: "Check the soil by hand and water according to your usual practice for this plant if it feels dry.",
        reasons: [`Moisture is declining at about ${Math.abs(summary.estimatedChangePercentPerHour ?? 0).toFixed(2)} points per hour.`],
      };
    case "rising":
      return { ...base, assessment, recommendedAction: "No watering is indicated by the readings; let the soil dry before reassessing.", reasons: ["Moisture is rising."] };
    case "stable":
      return { ...base, assessment, recommendedAction: "No change is indicated by the readings; keep observing.", reasons: ["Moisture is stable."] };
  }
}
