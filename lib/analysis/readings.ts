/**
 * Reading hygiene: everything downstream works on clean, ordered points.
 */

export type ReadingInput = {
  recordedAt: string;
  soilMoisturePercent: number | null;
  source?: string;
};

export type MoisturePoint = {
  /** Milliseconds since epoch. */
  t: number;
  moisture: number;
  source?: string;
};

export type CleanResult = { points: MoisturePoint[]; discarded: number };

/**
 * Drops readings with missing, non-finite or out-of-range moisture or an
 * unparseable timestamp, sorts by time, and keeps the first reading for any
 * duplicated timestamp. Reports how many were discarded.
 */
export function cleanReadings(readings: ReadingInput[]): CleanResult {
  const valid: MoisturePoint[] = [];
  for (const r of readings) {
    const t = Date.parse(r.recordedAt);
    const m = r.soilMoisturePercent;
    if (!Number.isFinite(t) || m == null || !Number.isFinite(m) || m < 0 || m > 100) continue;
    valid.push({ t, moisture: m, source: r.source });
  }
  valid.sort((a, b) => a.t - b.t);

  const points: MoisturePoint[] = [];
  for (const p of valid) {
    if (points.length && points[points.length - 1].t === p.t) continue;
    points.push(p);
  }
  return { points, discarded: readings.length - points.length };
}

/** Points with start < t <= end. */
export function selectWindow(points: MoisturePoint[], end: number, hours: number): MoisturePoint[] {
  const start = end - hours * 3_600_000;
  return points.filter((p) => p.t > start && p.t <= end);
}

export function spanHours(points: MoisturePoint[]): number {
  return points.length < 2 ? 0 : (points[points.length - 1].t - points[0].t) / 3_600_000;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
