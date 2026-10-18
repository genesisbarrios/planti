import "server-only";
import { connection } from "next/server";
import { classifyFreshness, deviceConnection, type DeviceConnection, type FreshnessResult } from "@/lib/analysis/freshness";
import { getCurrentUser } from "@/lib/auth";
import { deviceOnlineThresholdMinutes, isConfigured, missingEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Assessment, CareEvent, Device, InterventionOutcome, Plant, SensorReading } from "@/lib/types/domain";
import { latestReadingAtByDevice, listDevices } from "./devices";
import {
  ASSESSMENT_COLUMNS,
  CARE_EVENT_COLUMNS,
  OUTCOME_COLUMNS,
  PLANT_COLUMNS,
  READING_COLUMNS,
  toAssessment,
  toCareEvent,
  toOutcome,
  toPlant,
  toReading,
  type AssessmentRow,
  type CareEventRow,
  type OutcomeRow,
  type PlantRow,
  type SensorReadingRow,
} from "./mappers";

/** How much history the dashboard chart shows. */
export const HISTORY_WINDOW_HOURS = 7 * 24;
const HISTORY_LIMIT = 1000;

export type DeviceStatus = Device & {
  connection: DeviceConnection;
  latestReadingAt: string | null;
};

export type DashboardView = {
  plants: Plant[];
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
  | { kind: "no_plants"; view: DashboardView }
  | { kind: "ready"; view: DashboardView };

function emptyView(now: Date): DashboardView {
  const onlineThresholdMinutes = deviceOnlineThresholdMinutes();
  return {
    plants: [],
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
  return { ...device, latestReadingAt, connection: deviceConnection(latestReadingAt, now, thresholdMinutes) };
}

/** PostgREST / Postgres codes for "relation does not exist". */
function isMissingTable(code: string | undefined) {
  return code === "PGRST205" || code === "42P01";
}

/** Loads everything the dashboard renders for the signed-in user. */
export async function loadDashboard(selectedPlantId?: string): Promise<DashboardState> {
  // Render per request: readings, sessions and configuration all change.
  await connection();
  const now = new Date();
  const view = emptyView(now);

  if (!isConfigured("supabase")) {
    return { kind: "unconfigured", missing: missingEnv("supabase"), view };
  }
  const user = await getCurrentUser();
  if (!user) return { kind: "signed_out", view };

  const supabase = await createClient();
  const plantsResult = await supabase.from("plants").select(PLANT_COLUMNS).order("created_at", { ascending: true });
  if (plantsResult.error) {
    if (isMissingTable(plantsResult.error.code)) return { kind: "schema_pending", view };
    throw new Error("Could not load plants");
  }

  const plants = (plantsResult.data as PlantRow[]).map(toPlant);
  if (!plants.length) return { kind: "no_plants", view };
  const plant = plants.find((p) => p.id === selectedPlantId) ?? plants[0];

  const windowStart = new Date(now.getTime() - HISTORY_WINDOW_HOURS * 3_600_000).toISOString();
  const [historyResult, latestResult, careResult, assessmentResult, outcomeResult, devices] = await Promise.all([
    supabase
      .from("sensor_readings")
      .select(READING_COLUMNS)
      .eq("plant_id", plant.id)
      .gte("recorded_at", windowStart)
      .order("recorded_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase
      .from("sensor_readings")
      .select(READING_COLUMNS)
      .eq("plant_id", plant.id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("care_events").select(CARE_EVENT_COLUMNS).eq("plant_id", plant.id).order("occurred_at", { ascending: false }).limit(10),
    supabase
      .from("plant_assessments")
      .select(ASSESSMENT_COLUMNS)
      .eq("plant_id", plant.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("intervention_outcomes").select(OUTCOME_COLUMNS).eq("plant_id", plant.id).order("observed_at", { ascending: false }).limit(10),
    listDevices(supabase, plant.id),
  ]);

  for (const result of [historyResult, latestResult, careResult, assessmentResult, outcomeResult]) {
    if (result.error) throw new Error("Could not load plant data");
  }

  const readings = (historyResult.data as SensorReadingRow[]).map(toReading).reverse();
  const latestReading = latestResult.data ? toReading(latestResult.data as SensorReadingRow) : null;

  // Show the device that reported most recently; a paired-but-silent device
  // is still shown (as never reported) when it is the only one.
  const latestByDevice = await latestReadingAtByDevice(supabase, devices.map((d) => d.id));
  const deviceStatuses = devices
    .map((d) => toDeviceStatus(d, latestByDevice.get(d.id) ?? null, now, view.onlineThresholdMinutes))
    .sort((a, b) => (b.latestReadingAt ?? "").localeCompare(a.latestReadingAt ?? ""));

  return {
    kind: "ready",
    view: {
      ...view,
      plants,
      plant,
      readings,
      latestReading,
      device: deviceStatuses[0] ?? null,
      careEvents: (careResult.data as CareEventRow[]).map(toCareEvent),
      latestAssessment: assessmentResult.data ? toAssessment(assessmentResult.data as AssessmentRow) : null,
      outcomes: (outcomeResult.data as OutcomeRow[]).map(toOutcome),
      freshness: classifyFreshness(latestReading?.recordedAt, now, view.onlineThresholdMinutes),
    },
  };
}
