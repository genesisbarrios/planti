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

export type SimulatedTimeline = {
  scenario: ScenarioId;
  seed: number;
  readings: SimulatedReading[];
  careEvents: SimulatedCareEvent[];
};

export type ScenarioId = "gradual_decline" | "watering_response";

export type ScenarioOptions = {
  /** Timeline ends at this instant; readings go back `hours` from here. */
  end: Date;
  hours?: number;
  intervalMinutes?: number;
  seed?: number;
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

export function generateScenario(scenario: ScenarioId, options: ScenarioOptions): SimulatedTimeline {
  const { end, hours = 72, intervalMinutes = 30, seed = 42 } = options;
  const rng = createRng(seed);
  const steps = Math.floor((hours * 60) / intervalMinutes);
  const start = end.getTime() - steps * intervalMinutes * 60_000;

  const dryingPerHour = 0.45;
  const wateringAtHour = scenario === "watering_response" ? hours * (2 / 3) : null;
  const wateringRise = 26;

  const readings: SimulatedReading[] = [];
  let moisture = 64;
  for (let i = 0; i <= steps; i++) {
    const t = start + i * intervalMinutes * 60_000;
    const hour = (i * intervalMinutes) / 60;

    if (i > 0) moisture -= dryingPerHour * (intervalMinutes / 60);
    // Water soaks in over about an hour after the event.
    if (wateringAtHour !== null && hour > wateringAtHour && hour <= wateringAtHour + 1) {
      moisture += wateringRise * (intervalMinutes / 60);
    }
    moisture = clamp(moisture, 3, 95);

    const percent = round1(clamp(moisture + rng.gaussian(0.6), 0, 100));
    const hourOfDay = new Date(t).getUTCHours() + new Date(t).getUTCMinutes() / 60;
    const temperature = round1(22 + 1.8 * Math.sin(((hourOfDay - 9) / 24) * 2 * Math.PI) + rng.gaussian(0.2));

    readings.push({
      recordedAt: new Date(t).toISOString(),
      soilMoisturePercent: percent,
      temperatureC: temperature,
      soilMoistureStatus: simulatedStatus(percent),
    });
  }

  const careEvents: SimulatedCareEvent[] =
    wateringAtHour === null
      ? []
      : [{ eventType: "watered", occurredAt: new Date(start + wateringAtHour * 3_600_000).toISOString(), amountMl: 300 }];

  return { scenario, seed, readings, careEvents };
}
