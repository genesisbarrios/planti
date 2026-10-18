import type { TrendSummary } from "@/lib/analysis/analyze";
import { cleanReadings, median } from "@/lib/analysis/readings";
import type { Assessment, CareEvent, Plant, SensorReading } from "@/lib/types/domain";

/** Bounds on what is sent to the model. */
export const EVIDENCE_LIMITS = {
  historyHours: 48,
  maxHistoryPoints: 48,
  maxCareEvents: 10,
  maxPriorAssessments: 3,
  maxTextChars: 400,
} as const;

const clip = (s: string | null | undefined, max: number = EVIDENCE_LIMITS.maxTextChars) =>
  s == null ? null : s.length > max ? `${s.slice(0, max)}…` : s;

/** Hourly medians over the recent history window, oldest first. */
export function summarizeHistory(readings: SensorReading[], now: Date) {
  const since = now.getTime() - EVIDENCE_LIMITS.historyHours * 3_600_000;
  const { points } = cleanReadings(readings);
  const buckets = new Map<number, number[]>();
  for (const p of points) {
    if (p.t <= since || p.t > now.getTime()) continue;
    const hour = Math.floor(p.t / 3_600_000);
    buckets.set(hour, [...(buckets.get(hour) ?? []), p.moisture]);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .slice(-EVIDENCE_LIMITS.maxHistoryPoints)
    .map(([hour, values]) => ({
      hour: new Date(hour * 3_600_000).toISOString(),
      moisture_percent: Math.round(median(values)! * 10) / 10,
      readings: values.length,
    }));
}

export type EvidencePayload = ReturnType<typeof buildEvidence>;

/**
 * The compact, structured evidence the model interprets. Calculated values
 * come from the deterministic analysis; raw readings are summarized, never
 * sent one by one.
 */
export function buildEvidence(input: {
  plant: Plant;
  analysis: TrendSummary;
  readings: SensorReading[];
  careEvents: CareEvent[];
  priorAssessments: Assessment[];
  now: Date;
}) {
  const { plant, analysis, readings, careEvents, priorAssessments, now } = input;
  const latest = readings.at(-1) ?? null;

  return {
    now: now.toISOString(),
    plant: {
      name: clip(plant.name, 120),
      species: clip(plant.species, 200) ?? "unknown",
      location: clip(plant.location),
      light_conditions: clip(plant.lightConditions),
      pot_and_soil: clip(plant.potNotes),
      notes: clip(plant.notes),
      user_care_preferences: Object.fromEntries(
        Object.entries(plant.carePreferences).map(([k, v]) => [k, typeof v === "string" ? clip(v) : null]),
      ),
    },
    sources: analysis.sources,
    calculated: {
      trend: analysis.trend,
      estimated_change_percent_per_hour: analysis.estimatedChangePercentPerHour,
      trend_fit_r_squared: analysis.rSquared,
      trend_readings: analysis.trendSampleCount,
      trend_span_hours: analysis.trendSpanHours,
      trend_segment_start: analysis.trendSegmentStart,
      readings_in_window: analysis.sampleCount,
      window_hours: analysis.windowHours,
      latest_moisture_percent: analysis.latestMoisturePercent,
      latest_reading_at: analysis.latestReadingAt,
      data_freshness: analysis.dataFreshness,
      minutes_since_latest_reading: analysis.freshnessAgeMinutes,
      last_watering_at: analysis.lastWateringAt,
      confidence: analysis.confidence,
      confidence_reasons: analysis.confidenceReasons,
      limitations: analysis.limitations,
      sudden_changes: analysis.suddenChanges.map((c) => ({
        direction: c.direction,
        started_at: c.startedAt,
        from_percent: c.fromPercent,
        to_percent: c.toPercent,
      })),
      responses_after_watering: analysis.interventions.map((i) => ({
        watered_at: i.eventAt,
        outcome: i.outcome,
        before_percent: i.before.medianPercent,
        after_percent: i.after.medianPercent,
        change_points: i.changePoints,
      })),
    },
    latest_reading: latest
      ? {
          recorded_at: latest.recordedAt,
          moisture_percent: latest.soilMoisturePercent,
          temperature_c: latest.temperatureC,
          sensor_status: latest.soilMoistureStatus,
          source: latest.source,
        }
      : null,
    hourly_moisture_last_48h: summarizeHistory(readings, now),
    care_events: careEvents.slice(0, EVIDENCE_LIMITS.maxCareEvents).map((e) => ({
      type: e.eventType,
      at: e.occurredAt,
      amount_ml: e.amountMl,
      notes: clip(e.notes, 200),
    })),
    previous_assessments: priorAssessments.slice(0, EVIDENCE_LIMITS.maxPriorAssessments).map((a) => ({
      at: a.createdAt,
      assessment: clip(a.assessment),
      recommended_action: clip(a.recommendedAction),
      confidence: a.confidence,
    })),
  };
}

/**
 * Identifies the state of the evidence. If it has not changed since the last
 * assessment, the stored assessment is reused instead of calling the model.
 */
export function evidenceFingerprint(input: { plant: Plant; readings: SensorReading[]; careEvents: CareEvent[] }): string {
  const latestReading = input.readings.at(-1);
  const latestCare = input.careEvents[0];
  return [
    input.plant.updatedAt,
    latestReading ? `${latestReading.id}@${latestReading.recordedAt}` : "no-readings",
    input.readings.length,
    latestCare ? `${latestCare.id}@${latestCare.occurredAt}` : "no-care",
    input.careEvents.length,
  ].join("|");
}
