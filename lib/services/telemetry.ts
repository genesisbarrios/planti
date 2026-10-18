import "server-only";
import { verifyDeviceCredential } from "@/lib/devices/credentials";
import { deviceIngestionSecret } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkTimestamp, type TelemetryPayload } from "@/lib/validation/telemetry";
import { refreshOutcomes } from "./outcomes";

export type IngestResult =
  | { ok: true; accepted: number; duplicates: number; rejected: number }
  | { ok: false; error: "unauthorized" | "failed" };

/**
 * Stores readings from a physical device. The device is authenticated by its
 * credential (compared in constant time against the stored keyed hash), and
 * the plant is taken from the device record, never from the request.
 */
export async function ingestTelemetry(payload: TelemetryPayload, credential: string, now = new Date()): Promise<IngestResult> {
  const admin = createAdminClient();
  const { data: device, error } = await admin.from("devices").select("id, plant_id, device_key_hash").eq("id", payload.deviceId).maybeSingle();
  if (error) {
    console.error("telemetry: device lookup failed", error.code);
    return { ok: false, error: "failed" };
  }
  // Same response for unknown devices and wrong credentials: no enumeration.
  if (!device || !verifyDeviceCredential(credential, device.device_key_hash as string, deviceIngestionSecret())) {
    return { ok: false, error: "unauthorized" };
  }

  let accepted = 0;
  let duplicates = 0;
  let rejected = 0;
  for (const r of payload.readings) {
    if (checkTimestamp(r.recordedAt, now) !== "ok") {
      rejected++;
      continue;
    }
    const { error: insertError } = await admin.from("sensor_readings").insert({
      plant_id: device.plant_id,
      device_id: device.id,
      recorded_at: r.recordedAt ?? now.toISOString(),
      temperature_c: r.temperatureC ?? null,
      soil_moisture_raw: r.soilMoistureRaw ?? null,
      soil_moisture_percent: r.soilMoisturePercent ?? null,
      soil_moisture_status: r.soilMoistureStatus,
      source: "device",
      metadata: r.metadata ?? {},
    });
    if (!insertError) accepted++;
    // Unique (device_id, recorded_at): a retried or replayed upload.
    else if (insertError.code === "23505") duplicates++;
    else {
      console.error("telemetry: insert failed", insertError.code);
      rejected++;
    }
  }

  const { error: updateError } = await admin
    .from("devices")
    .update({ last_seen_at: now.toISOString(), ...(payload.firmwareVersion ? { firmware_version: payload.firmwareVersion } : {}) })
    .eq("id", device.id);
  if (updateError) console.error("telemetry: device update failed", updateError.code);

  if (accepted > 0) {
    // New readings may resolve pending watering outcomes. The plant comes
    // from the verified device, so the service-role read is correctly scoped.
    await refreshOutcomes(admin, device.plant_id as string, now).catch(() => undefined);
  }
  return { ok: true, accepted, duplicates, rejected };
}
