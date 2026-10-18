/**
 * Data freshness and device connection rules. Pure functions: callers pass
 * `now` so results are deterministic and testable.
 */

export type DataFreshness = "fresh" | "stale" | "none";

export type FreshnessResult = {
  freshness: DataFreshness;
  /** Whole minutes since the timestamp, or null when there is no timestamp. */
  ageMinutes: number | null;
};

function toMillis(value: string | Date | null | undefined): number | null {
  if (value == null) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Classifies how recent a timestamp is. Timestamps slightly in the future
 * (device clock drift) count as age 0 rather than negative.
 */
export function classifyFreshness(
  lastAt: string | Date | null | undefined,
  now: Date,
  staleAfterMinutes: number,
): FreshnessResult {
  const lastMs = toMillis(lastAt);
  if (lastMs === null) return { freshness: "none", ageMinutes: null };

  const ageMinutes = Math.max(0, Math.floor((now.getTime() - lastMs) / 60_000));
  return { freshness: ageMinutes <= staleAfterMinutes ? "fresh" : "stale", ageMinutes };
}

export type DeviceConnection = "online" | "stale" | "never_reported";

/**
 * A device is online only if it delivered a reading within the threshold.
 * The existence of a device record alone never makes it online.
 */
export function deviceConnection(
  latestDeviceReadingAt: string | Date | null | undefined,
  now: Date,
  onlineThresholdMinutes: number,
): DeviceConnection {
  const { freshness } = classifyFreshness(latestDeviceReadingAt, now, onlineThresholdMinutes);
  if (freshness === "none") return "never_reported";
  return freshness === "fresh" ? "online" : "stale";
}
