import "server-only";
import { connection } from "next/server";
import { classifyFreshness, deviceConnection, type DeviceConnection, type FreshnessResult } from "@/lib/analysis/freshness";
import { deviceOnlineThresholdMinutes, isConfigured, missingEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type {
  Assessment,
  CareEvent,
  Device,
  InterventionOutcome,
  Plant,
  SensorReading,
} from "@/lib/types/domain";

export type DeviceStatus = Device & {
  connection: DeviceConnection;
  latestReadingAt: string | null;
};

export type DashboardView = {
  plant: Plant | null;
  latestReading: SensorReading | null;
  readings: SensorReading[];
  device: DeviceStatus | null;
  careEvents: CareEvent[];
  latestAssessment: Assessment | null;
  outcomes: InterventionOutcome[];
  freshness: FreshnessResult;
  onlineThresholdMinutes: number;
};

export type DashboardState =
  | { kind: "unconfigured"; missing: string[]; view: DashboardView }
  | { kind: "signed_out"; view: DashboardView }
  | { kind: "schema_pending"; view: DashboardView }
  | { kind: "ready"; view: DashboardView };

function emptyView(now: Date): DashboardView {
  const onlineThresholdMinutes = deviceOnlineThresholdMinutes();
  return {
    plant: null,
    latestReading: null,
    readings: [],
    device: null,
    careEvents: [],
    latestAssessment: null,
    outcomes: [],
    freshness: classifyFreshness(null, now, onlineThresholdMinutes),
    onlineThresholdMinutes,
  };
}

/** Derives connection state for a device from its most recent reading. */
export function toDeviceStatus(device: Device, latestReadingAt: string | null, now: Date, thresholdMinutes: number): DeviceStatus {
  return {
    ...device,
    latestReadingAt,
    connection: deviceConnection(latestReadingAt, now, thresholdMinutes),
  };
}

/**
 * Loads everything the dashboard renders for the signed-in user. Phase 1 only
 * resolves configuration and session state; plant queries arrive with the
 * Supabase schema in Phase 2.
 */
export async function loadDashboard(): Promise<DashboardState> {
  // Render per request: readings, sessions and configuration all change.
  await connection();
  const now = new Date();
  const view = emptyView(now);

  if (!isConfigured("supabase")) {
    return { kind: "unconfigured", missing: missingEnv("supabase"), view };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    return { kind: "signed_out", view };
  }

  return { kind: "schema_pending", view };
}
