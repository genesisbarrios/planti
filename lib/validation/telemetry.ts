import { z } from "zod";
import { MOISTURE_STATUSES } from "@/lib/types/domain";

/** Clock tolerance for device timestamps, and the oldest buffered reading accepted. */
export const TELEMETRY_LIMITS = { maxFutureMinutes: 5, maxAgeHours: 72, maxBatch: 50 } as const;

/** Small, known diagnostic fields only; anything else is dropped. */
const metadataSchema = z
  .object({
    sensor: z.string().max(40).optional(),
    calibration: z.enum(["default", "custom"]).optional(),
    calibrationDryRaw: z.number().int().min(0).max(65535).optional(),
    calibrationWetRaw: z.number().int().min(0).max(65535).optional(),
    rssi: z.number().int().min(-127).max(0).optional(),
    uptimeSeconds: z.number().int().min(0).optional(),
  })
  .strip();

export const telemetryReadingSchema = z
  .object({
    // Optional: a device without a synced clock lets the server stamp receipt time.
    recordedAt: z.iso.datetime({ offset: true }).optional(),
    temperatureC: z.number().min(-40).max(85).nullable().optional(),
    soilMoistureRaw: z.number().int().min(0).max(65535).nullable().optional(),
    soilMoisturePercent: z.number().min(0).max(100).nullable().optional(),
    soilMoistureStatus: z.enum(MOISTURE_STATUSES).optional().default("unknown"),
    // The physical-device endpoint only accepts device readings.
    source: z.literal("device", { error: "Only device readings are accepted on this endpoint" }),
    metadata: metadataSchema.optional(),
  })
  .strip()
  .refine((r) => r.soilMoistureRaw != null || r.soilMoisturePercent != null, "A reading needs a moisture value");

/**
 * Accepts the single-reading payload from the spec, or a batch of buffered
 * readings. Ownership fields such as plantId are not part of the schema and
 * are stripped: the plant always comes from the authenticated device record.
 */
export const telemetryPayloadSchema = z.union([
  z
    .object({
      deviceId: z.uuid(),
      firmwareVersion: z.string().trim().max(40).optional(),
      readings: z.array(telemetryReadingSchema).min(1).max(TELEMETRY_LIMITS.maxBatch),
    })
    .strip(),
  z
    .object({ deviceId: z.uuid(), firmwareVersion: z.string().trim().max(40).optional() })
    .strip()
    .and(telemetryReadingSchema)
    .transform(({ deviceId, firmwareVersion, ...reading }) => ({ deviceId, firmwareVersion, readings: [reading] })),
]);

export type TelemetryPayload = z.output<typeof telemetryPayloadSchema>;
export type TelemetryReading = z.output<typeof telemetryReadingSchema>;

/** Rejects timestamps from the future or too far in the past. */
export function checkTimestamp(recordedAt: string | undefined, now: Date): "ok" | "future" | "too_old" {
  if (!recordedAt) return "ok";
  const t = Date.parse(recordedAt);
  if (t > now.getTime() + TELEMETRY_LIMITS.maxFutureMinutes * 60_000) return "future";
  if (t < now.getTime() - TELEMETRY_LIMITS.maxAgeHours * 3_600_000) return "too_old";
  return "ok";
}

/** `Authorization: Bearer <credential>` → credential, or null. */
export function bearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

/** True when the body claims any source other than "device" (e.g. simulated). */
export function claimsNonDeviceSource(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const record = body as { source?: unknown; readings?: unknown };
  const sources = [record.source, ...(Array.isArray(record.readings) ? record.readings.map((r) => (r as { source?: unknown })?.source) : [])];
  return sources.some((s) => s !== undefined && s !== "device");
}
