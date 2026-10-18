import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { simulatorEnabled } from "@/lib/env";
import { generateScenario, type ScenarioId } from "@/lib/simulation/scenarios";
import { getOwnedPlant } from "./plants";

export type SimulationResult =
  | { ok: true; readings: number; careEvents: number }
  | { ok: false; error: "disabled" | "not_found" | "failed" };

/**
 * Replaces a plant's simulated history with a seeded scenario. Runs entirely
 * through the user-scoped client, so RLS guarantees it can only touch the
 * caller's own plant, only insert source = 'simulated', and only delete
 * simulated readings. Device readings are never affected.
 */
export async function runScenario(
  supabase: SupabaseClient,
  userId: string,
  plantId: string,
  scenario: ScenarioId,
  seed: number,
  now = new Date(),
): Promise<SimulationResult> {
  if (!simulatorEnabled()) return { ok: false, error: "disabled" };
  const plant = await getOwnedPlant(supabase, plantId);
  if (!plant) return { ok: false, error: "not_found" };

  const clearReadings = await supabase.from("sensor_readings").delete().eq("plant_id", plant.id).eq("source", "simulated");
  const clearEvents = await supabase.from("care_events").delete().eq("plant_id", plant.id).eq("metadata->>simulated", "true");
  if (clearReadings.error || clearEvents.error) {
    console.error("runScenario: clear failed", clearReadings.error?.code, clearEvents.error?.code);
    return { ok: false, error: "failed" };
  }

  const timeline = generateScenario(scenario, { end: now, seed });
  const metadata = { simulated: true, scenario, seed };

  const readings = await supabase.from("sensor_readings").insert(
    timeline.readings.map((r) => ({
      plant_id: plant.id,
      recorded_at: r.recordedAt,
      soil_moisture_percent: r.soilMoisturePercent,
      temperature_c: r.temperatureC,
      soil_moisture_status: r.soilMoistureStatus,
      source: "simulated",
      metadata,
    })),
  );
  if (readings.error) {
    console.error("runScenario: insert readings failed", readings.error.code);
    return { ok: false, error: "failed" };
  }

  if (timeline.careEvents.length) {
    const events = await supabase.from("care_events").insert(
      timeline.careEvents.map((e) => ({
        plant_id: plant.id,
        user_id: userId,
        event_type: e.eventType,
        occurred_at: e.occurredAt,
        amount_ml: e.amountMl,
        notes: "Simulated care event",
        metadata,
      })),
    );
    if (events.error) {
      console.error("runScenario: insert care events failed", events.error.code);
      return { ok: false, error: "failed" };
    }
  }

  return { ok: true, readings: timeline.readings.length, careEvents: timeline.careEvents.length };
}

/** Removes all simulated readings and simulated care events for a plant. */
export async function clearSimulation(supabase: SupabaseClient, plantId: string): Promise<boolean> {
  if (!simulatorEnabled()) return false;
  const plant = await getOwnedPlant(supabase, plantId);
  if (!plant) return false;
  const a = await supabase.from("sensor_readings").delete().eq("plant_id", plant.id).eq("source", "simulated");
  const b = await supabase.from("care_events").delete().eq("plant_id", plant.id).eq("metadata->>simulated", "true");
  return !a.error && !b.error;
}
