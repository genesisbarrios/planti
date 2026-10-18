/**
 * Analysis thresholds. These are HEURISTICS chosen for a capacitive soil
 * sensor reporting every few minutes; they describe data quality, not plant
 * biology. None of them is a watering threshold for any plant or soil type.
 */
export type AnalysisConfig = {
  /** Hours of history considered for trend estimation. */
  windowHours: number;
  /** Fewer usable readings than this → insufficient_data. */
  minSamples: number;
  /** Shorter time span than this (hours) → insufficient_data. */
  minSpanHours: number;
  /** |slope| below this (% points/hour) counts as stable. */
  stableSlopePerHour: number;
  /** Below this R², a non-flat slope is reported as unclear, not a trend. */
  minTrendRSquared: number;
  /** Change (% points) within the lookback window treated as a sudden change. */
  suddenChangePoints: number;
  /** How far back (minutes) a reading is compared when looking for sudden changes. */
  suddenChangeLookbackMinutes: number;
  /** After watering, readings within this many minutes are skipped while water soaks in. */
  settleMinutes: number;
  /** Data older than this (minutes) is stale. */
  staleAfterMinutes: number;
  /** Before/after comparison windows around a care event (hours). */
  interventionBeforeHours: number;
  interventionAfterHours: number;
  /** Readings needed on each side of a care event to compare them. */
  interventionMinSamples: number;
  /** Median rise (% points) needed to report an observed increase. */
  interventionMinRisePoints: number;
};

export const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
  windowHours: 72,
  minSamples: 8,
  minSpanHours: 6,
  stableSlopePerHour: 0.1,
  minTrendRSquared: 0.5,
  suddenChangePoints: 8,
  suddenChangeLookbackMinutes: 90,
  settleMinutes: 60,
  staleAfterMinutes: 60,
  interventionBeforeHours: 6,
  interventionAfterHours: 6,
  interventionMinSamples: 3,
  interventionMinRisePoints: 5,
};
