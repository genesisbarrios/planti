import type { MoistureStatus } from "@/lib/types/domain";
import { createRng } from "./random";

/**
 * Deterministic simulated timelines. Output is plain data; callers persist it
 * with source = 'simulated'. Nothing here is ever presented as a measurement.
 */

export type SimulatedReading = {
  recordedAt: string;
  soilMoisturePercent: number;
  temperatureC: number;
  soilMoistureStatus: MoistureStatus;
};

export type SimulatedCareEvent = {
  eventType: "watered";
  occurredAt: string;
  amountMl: number;
};

export const SCENARIOS = {
  gradual_decline: { label: "Moisture gradually declining", description: "Steady drying over three days, no watering." },
  watering_response: { label: "Watering, then a moisture increase", description: "Drying, a logged watering, a rise, then drying again." },
  stable: { label: "Stable moisture", description: "Moisture holds roughly steady." },
  noisy: { label: "Noisy sensor", description: "A slow decline buried in large sensor noise." },
  stale: { label: "Stale or disconnected device", description: "Drying readings that stop six hours before now." },
} as const;

export type ScenarioId = keyof typeof SCENARIOS;

export function isScenarioId(value: unknown): value is ScenarioId {
  return typeof value === "string" && Object.hasOwn(SCENARIOS, value);
}

export type SimulatedTimeline = {
  scenario: ScenarioId;
  seed: number;
  readings: SimulatedReading[];
  careEvents: SimulatedCareEvent[];
};

export type ScenarioOptions = {
  /** Timeline is anchored to this instant ("now"). */
  end: Date;
  hours?: number;
  intervalMinutes?: number;
  seed?: number;
};

type Params = {
  startPercent: number;
  dryingPerHour: number;
  noiseSd: number;
  /** Fraction of the timeline at which watering happens, if any. */
  wateringAt: number | null;
  /** Readings stop this many hours before `end`. */
  silentHours: number;
};

const PARAMS: Record<ScenarioId, Params> = {
  gradual_decline: { startPercent: 66, dryingPerHour: 0.45, noiseSd: 0.6, wateringAt: null, silentHours: 0 },
  watering_response: { startPercent: 64, dryingPerHour: 0.45, noiseSd: 0.6, wateringAt: 2 / 3, silentHours: 0 },
  stable: { startPercent: 48, dryingPerHour: 0.02, noiseSd: 0.5, wateringAt: null, silentHours: 0 },
  noisy: { startPercent: 58, dryingPerHour: 0.15, noiseSd: 7, wateringAt: null, silentHours: 0 },
  stale: { startPercent: 62, dryingPerHour: 0.45, noiseSd: 0.6, wateringAt: null, silentHours: 6 },
};

/**
 * Status bands mimic what a sensor display might show. They are a labeling
 * heuristic for simulated data only, not a watering threshold for any plant.
 */
export function simulatedStatus(percent: number): MoistureStatus {
  if (percent < 25) return "dry";
  if (percent > 75) return "wet";
  return "adequate";
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
const WATERING_RISE = 26;

export function generateScenario(scenario: ScenarioId, options: ScenarioOptions): SimulatedTimeline {
  const { end, hours = 72, intervalMinutes = 30, seed = 42 } = options;
  const p = PARAMS[scenario];
  const rng = createRng(seed);
  const intervalMs = intervalMinutes * 60_000;
  const steps = Math.floor((hours * 60) / intervalMinutes);
  const start = end.getTime() - steps * intervalMs;
  const lastReadingAt = end.getTime() - p.silentHours * 3_600_000;
  const wateringHour = p.wateringAt === null ? null : hours * p.wateringAt;

  const readings: SimulatedReading[] = [];
  let moisture = p.startPercent;
  for (let i = 0; i <= steps; i++) {
    const t = start + i * intervalMs;
    const hour = (i * intervalMinutes) / 60;
    if (i > 0) moisture -= p.dryingPerHour * (intervalMinutes / 60);
    // Water soaks in over about an hour after the event.
    if (wateringHour !== null && hour > wateringHour && hour <= wateringHour + 1) {
      moisture += WATERING_RISE * (intervalMinutes / 60);
    }
    moisture = clamp(moisture, 3, 95);

    // Draw noise for every step, even silent ones, so the visible readings of
    // a scenario do not depend on how many trailing readings are dropped.
    const percent = round1(clamp(moisture + rng.gaussian(p.noiseSd), 0, 100));
    const date = new Date(t);
    const hourOfDay = date.getUTCHours() + date.getUTCMinutes() / 60;
    const temperature = round1(22 + 1.8 * Math.sin(((hourOfDay - 9) / 24) * 2 * Math.PI) + rng.gaussian(0.2));
    if (t > lastReadingAt) continue;

    readings.push({
      recordedAt: date.toISOString(),
      soilMoisturePercent: percent,
      temperatureC: temperature,
      soilMoistureStatus: simulatedStatus(percent),
    });
  }

  const careEvents: SimulatedCareEvent[] =
    wateringHour === null
      ? []
      : [{ eventType: "watered", occurredAt: new Date(start + wateringHour * 3_600_000).toISOString(), amountMl: 300 }];

  return { scenario, seed, readings, careEvents };
}
