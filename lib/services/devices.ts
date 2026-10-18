import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateDeviceCredential, hashDeviceCredential } from "@/lib/devices/credentials";
import { deviceIngestionSecret } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEVICE_COLUMNS, toDevice, type DeviceRow } from "./mappers";
import { getOwnedPlant } from "./plants";

export async function listDevices(supabase: SupabaseClient, plantId: string) {
  const { data, error } = await supabase
    .from("devices")
    .select(DEVICE_COLUMNS)
    .eq("plant_id", plantId)
    .order("created_at", { ascending: true });
  if (error) throw new Error("Could not load devices");
  return (data as DeviceRow[]).map(toDevice);
}

/** Most recent reading timestamp per device, from readings the user can see. */
export async function latestReadingAtByDevice(supabase: SupabaseClient, deviceIds: string[]) {
  const entries = await Promise.all(
    deviceIds.map(async (id) => {
      const { data } = await supabase
        .from("sensor_readings")
        .select("recorded_at")
        .eq("device_id", id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return [id, (data?.recorded_at as string | undefined) ?? null] as const;
    }),
  );
  return new Map(entries);
}

export type ProvisionResult =
  | { ok: true; deviceId: string; credential: string }
  | { ok: false; error: "not_found" | "not_configured" | "failed" };

/**
 * Creates a device for a plant the caller owns. Ownership is checked with the
 * user-scoped client first; only then does the service-role client write the
 * credential hash. The plaintext credential is returned once and never stored.
 */
export async function provisionDevice(
  userClient: SupabaseClient,
  plantId: string,
  deviceName: string | null,
): Promise<ProvisionResult> {
  const plant = await getOwnedPlant(userClient, plantId);
  if (!plant) return { ok: false, error: "not_found" };

  let secret: string;
  try {
    secret = deviceIngestionSecret();
  } catch {
    return { ok: false, error: "not_configured" };
  }

  const credential = generateDeviceCredential();
  const { data, error } = await createAdminClient()
    .from("devices")
    .insert({ plant_id: plant.id, device_name: deviceName, device_key_hash: hashDeviceCredential(credential, secret) })
    .select("id")
    .single();
  if (error || !data) {
    console.error("provisionDevice: insert failed", error?.code);
    return { ok: false, error: "failed" };
  }
  return { ok: true, deviceId: data.id as string, credential };
}

/** Owner-initiated removal; RLS only allows deleting devices on owned plants. */
export async function deleteDevice(supabase: SupabaseClient, deviceId: string) {
  const { data, error } = await supabase.from("devices").delete().eq("id", deviceId).select("id");
  if (error) throw new Error("Could not remove device");
  return (data ?? []).length > 0;
}
