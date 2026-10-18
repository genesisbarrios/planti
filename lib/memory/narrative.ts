import type { TrendSummary } from "@/lib/analysis/analyze";

/**
 * Builds the Plant Memory narrative from the deterministic analysis only.
 * Every sentence is conditional on evidence in the summary; nothing here can
 * claim a trend, a response or a learned pattern the data does not show.
 */
export function buildNarrative(summary: TrendSummary, now: Date): string[] {
  if (summary.dataFreshness === "none") {
    return ["No readings yet. Planti needs moisture readings before it can describe how this plant behaves."];
  }

  const sentences: string[] = [];
  const span = formatHours(summary.trendSpanHours);
  const rate = summary.estimatedChangePercentPerHour;
  const sinceWatering =
    summary.lastWateringAt !== null &&
    summary.trendSegmentStart !== null &&
    Date.parse(summary.trendSegmentStart) >= Date.parse(summary.lastWateringAt);

  switch (summary.trend) {
    case "declining":
      sentences.push(
        sinceWatering
          ? `Moisture has been declining since the last watering ${relative(summary.lastWateringAt!, now)}, by about ${fmtRate(rate)} per hour over ${span}.`
          : `Moisture has been declining over the last ${span}, by about ${fmtRate(rate)} per hour.`,
      );
      break;
    case "rising":
      sentences.push(`Moisture has been rising over the last ${span}, by about ${fmtRate(rate)} per hour.`);
      break;
    case "stable":
      sentences.push(`Moisture has held roughly steady${summary.latestMoisturePercent !== null ? ` around ${Math.round(summary.latestMoisturePercent)}%` : ""} over the last ${span}.`);
      break;
    case "unclear":
      sentences.push(`Readings over the last ${span} vary too much to show a clear trend.`);
      break;
    case "insufficient_data":
      sentences.push(
        summary.trendSegmentStart !== null
          ? `Since the last watering or moisture jump there are only ${summary.trendSampleCount} readings over ${span}, not enough to estimate a drying pattern yet.`
          : `There are only ${summary.trendSampleCount} readings over ${span} so far, not enough to estimate a drying pattern.`,
      );
      break;
  }

  const latest = summary.interventions.at(-1);
  if (latest) {
    const when = relative(latest.eventAt, now);
    switch (latest.outcome) {
      case "moisture_increase_observed":
        sentences.push(
          `After the watering ${when}, moisture rose from about ${Math.round(latest.before.medianPercent!)}% to ${Math.round(latest.after.medianPercent!)}%${
            summary.trend === "declining" && sinceWatering ? " and has gradually declined since." : "."
          }`,
        );
        break;
      case "no_measurable_change":
        sentences.push(`After the watering ${when}, moisture did not change measurably.`);
        break;
      case "pending_observation":
        sentences.push(`Planti is still waiting for enough readings after the watering ${when} to see how moisture responded.`);
        break;
      case "inconclusive":
        sentences.push(`The response to the watering ${when} is unclear: ${lowerFirst(latest.explanation)}`);
        break;
    }
  }

  const observedRises = summary.interventions.filter((i) => i.outcome === "moisture_increase_observed").length;
  if (observedRises >= 2) {
    sentences.push(`Moisture rose after each of the last ${observedRises} waterings in this window.`);
  }
  if (summary.trend === "declining" && observedRises < 2) {
    sentences.push("More drying cycles are needed before this rate can be called typical for this plant.");
  }

  if (summary.dataFreshness === "stale" && summary.freshnessAgeMinutes !== null) {
    sentences.push(`The latest reading is ${formatHours(summary.freshnessAgeMinutes / 60)} old, so this may not reflect the soil right now.`);
  }
  if (summary.sources.includes("simulated")) {
    sentences.push(
      summary.sources.length === 1 ? "This history is simulated, not measured." : "This history mixes simulated and measured readings.",
    );
  }
  return sentences;
}

function fmtRate(rate: number | null): string {
  return rate === null ? "an unknown amount" : `${Math.abs(rate).toFixed(2)} points`;
}

export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} minutes`;
  if (hours < 48) {
    const h = Math.round(hours);
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  return `${Math.round(hours / 24)} days`;
}

export function relative(iso: string, now: Date): string {
  const hours = (now.getTime() - Date.parse(iso)) / 3_600_000;
  if (hours < 1) return "less than an hour ago";
  return `${formatHours(hours)} ago`;
}

function lowerFirst(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
