import { createRng } from "@/lib/simulation/random";

export const NOW = new Date("2026-10-18T12:00:00.000Z");

/**
 * Builds readings ending at `end` (default NOW), one every `intervalMinutes`,
 * with moisture given by `f(hoursSinceStart)` plus optional seeded noise.
 */
export function series(
  count: number,
  f: (hours: number) => number | null,
  { intervalMinutes = 30, end = NOW, noiseSd = 0, seed = 1, source = "device" } = {},
) {
  const rng = createRng(seed);
  const start = end.getTime() - (count - 1) * intervalMinutes * 60_000;
  return Array.from({ length: count }, (_, i) => {
    const hours = (i * intervalMinutes) / 60;
    const base = f(hours);
    return {
      recordedAt: new Date(start + i * intervalMinutes * 60_000).toISOString(),
      soilMoisturePercent: base === null ? null : base + rng.gaussian(noiseSd),
      source,
    };
  });
}

export const hoursAgo = (h: number, from = NOW) => new Date(from.getTime() - h * 3_600_000).toISOString();
