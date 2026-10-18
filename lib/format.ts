/** Display formatting helpers. All inputs are ISO-8601 UTC strings or numbers. */

export function formatPercent(value: number | null | undefined, digits = 1): string {
  return value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(digits)}%`;
}

export function formatTemperature(celsius: number | null | undefined): string {
  return celsius == null || !Number.isFinite(celsius) ? "—" : `${celsius.toFixed(1)}°C`;
}

export function formatAge(ageMinutes: number | null): string {
  if (ageMinutes == null) return "never";
  if (ageMinutes < 1) return "just now";
  if (ageMinutes < 60) return `${ageMinutes} min ago`;
  const hours = Math.floor(ageMinutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} days ago`;
}
