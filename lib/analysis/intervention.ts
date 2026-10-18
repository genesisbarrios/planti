import type { InterventionOutcomeKind } from "@/lib/types/domain";
import type { AnalysisConfig } from "./config";
import { linearFit } from "./moisture-trend";
import { median, type MoisturePoint } from "./readings";

export type SideSummary = {
  sampleCount: number;
  medianPercent: number | null;
  windowStart: string;
  windowEnd: string;
};

export type InterventionComparison = {
  outcome: InterventionOutcomeKind;
  eventAt: string;
  before: SideSummary;
  after: SideSummary;
  /** Median after minus median before, in % points; null when not comparable. */
  changePoints: number | null;
  /** Smallest change treated as measurable, given the noise before the event. */
  thresholdPoints: number;
  observationWindowMinutes: number;
  /** Plain-language observation. Describes what followed, never claims causation. */
  explanation: string;
};

const iso = (t: number) => new Date(t).toISOString();
const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Compares moisture just before a care event with moisture after it has had
 * time to soak in. Uses the readings closest to the event on each side, so a
 * steadily drying baseline is not averaged away.
 */
export function compareAroundEvent(
  points: MoisturePoint[],
  eventAt: string,
  now: Date,
  config: AnalysisConfig,
): InterventionComparison {
  const event = Date.parse(eventAt);
  const beforeStart = event - config.interventionBeforeHours * 3_600_000;
  const afterStart = event + config.settleMinutes * 60_000;
  const afterEnd = afterStart + config.interventionAfterHours * 3_600_000;
  const observationWindowMinutes = config.settleMinutes + config.interventionAfterHours * 60;
  const n = config.interventionMinSamples;

  const beforeWindow = points.filter((p) => p.t > beforeStart && p.t <= event);
  const afterWindow = points.filter((p) => p.t > afterStart && p.t <= afterEnd);
  const beforeNearest = beforeWindow.slice(-n);
  const afterNearest = afterWindow.slice(0, n);

  const before: SideSummary = {
    sampleCount: beforeWindow.length,
    medianPercent: beforeNearest.length >= n ? median(beforeNearest.map((p) => p.moisture)) : null,
    windowStart: iso(beforeStart),
    windowEnd: iso(event),
  };
  const after: SideSummary = {
    sampleCount: afterWindow.length,
    medianPercent: afterNearest.length >= n ? median(afterNearest.map((p) => p.moisture)) : null,
    windowStart: iso(afterStart),
    windowEnd: iso(afterEnd),
  };

  // Noise floor: spread of the pre-event readings around their own trend.
  const fit = linearFit(beforeWindow);
  const thresholdPoints = round1(Math.max(config.interventionMinRisePoints, 2 * (fit?.residualSd ?? 0)));
  const base = { eventAt, before, after, thresholdPoints, observationWindowMinutes };

  if (before.medianPercent === null) {
    return {
      ...base,
      outcome: "inconclusive",
      changePoints: null,
      explanation: `There were not enough readings in the ${config.interventionBeforeHours} hours before this event to establish a starting point.`,
    };
  }
  if (after.medianPercent === null) {
    const stillWaiting = now.getTime() < afterEnd;
    return {
      ...base,
      outcome: stillWaiting ? "pending_observation" : "inconclusive",
      changePoints: null,
      explanation: stillWaiting
        ? "Waiting for readings after the water has had time to soak in."
        : "Too few readings arrived after this event to compare with the readings before it.",
    };
  }

  const change = round1(after.medianPercent - before.medianPercent);
  const result = { ...base, changePoints: change };
  const from = `${round1(before.medianPercent)}%`;
  const to = `${round1(after.medianPercent)}%`;

  if (change >= thresholdPoints) {
    return {
      ...result,
      outcome: "moisture_increase_observed",
      explanation: `Moisture rose from about ${from} to about ${to} after this event (+${change} points). This is an observed response; other factors could contribute.`,
    };
  }
  if (Math.abs(change) < config.interventionMinRisePoints && thresholdPoints <= config.interventionMinRisePoints) {
    return {
      ...result,
      outcome: "no_measurable_change",
      explanation: `Moisture stayed around ${from} → ${to} after this event (${change >= 0 ? "+" : ""}${change} points), below the ${thresholdPoints}-point change Planti treats as measurable.`,
    };
  }
  return {
    ...result,
    outcome: "inconclusive",
    explanation: `Moisture went from about ${from} to ${to} (${change >= 0 ? "+" : ""}${change} points), but readings are too noisy to tell whether that is a real change.`,
  };
}
