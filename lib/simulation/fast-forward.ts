import { createRng } from "./random";
import { simulatedStatus, type SimulatedReading } from "./scenarios";

const WATERING_RISE = 26;

/**
 * Simulated readings that continue a timeline from `start` (exclusive) to
 * `end` (inclusive). Moisture dries at `dryingPerHour`; if `wateringAt` falls
 * inside the range, moisture rises over the following hour as water soaks in.
 * Deterministic for a given seed. Output is simulated data only.
 */
export function generateContinuation(input: {
  start: Date;
  end: Date;
  startMoisture: number;
  dryingPerHour: number;
  wateringAt: Date | null;
  intervalMinutes: number;
  seed: number;
}): SimulatedReading[] {
  const { start, end, startMoisture, dryingPerHour, wateringAt, intervalMinutes, seed } = input;
  const rng = createRng(seed);
  const stepMs = intervalMinutes * 60_000;
  const water = wateringAt?.getTime() ?? null;
  const readings: SimulatedReading[] = [];

  let moisture = startMoisture;
  for (let t = start.getTime() + stepMs; t <= end.getTime(); t += stepMs) {
    moisture -= Math.abs(dryingPerHour) * (intervalMinutes / 60);
    if (water !== null) {
      // Portion of this step that falls inside the hour after watering.
      const overlap = Math.max(0, Math.min(t, water + 3_600_000) - Math.max(t - stepMs, water));
      moisture += WATERING_RISE * (overlap / 3_600_000);
    }
    moisture = Math.min(95, Math.max(3, moisture));

    const percent = Math.round(Math.min(100, Math.max(0, moisture + rng.gaussian(0.6))) * 10) / 10;
    const date = new Date(t);
    const hourOfDay = date.getUTCHours() + date.getUTCMinutes() / 60;
    readings.push({
      recordedAt: date.toISOString(),
      soilMoisturePercent: percent,
      temperatureC: Math.round((22 + 1.8 * Math.sin(((hourOfDay - 9) / 24) * 2 * Math.PI) + rng.gaussian(0.2)) * 10) / 10,
      soilMoistureStatus: simulatedStatus(percent),
    });
  }
  return readings;
}

/** Median spacing between readings in minutes, for continuing at the same cadence. */
export function medianIntervalMinutes(timestamps: string[], fallback = 30): number {
  const ms = timestamps.map((t) => Date.parse(t)).filter(Number.isFinite).sort((a, b) => a - b);
  if (ms.length < 2) return fallback;
  const gaps = ms
    .slice(1)
    .map((t, i) => t - ms[i])
    .sort((a, b) => a - b);
  const minutes = gaps[Math.floor(gaps.length / 2)] / 60_000;
  return minutes >= 1 ? Math.round(minutes) : fallback;
}
