import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzePlant } from "@/lib/analysis/analyze";
import { simulatorEnabled } from "@/lib/env";
import { generateContinuation, medianIntervalMinutes } from "@/lib/simulation/fast-forward";
import { generateScenario, type ScenarioId } from "@/lib/simulation/scenarios";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteOutcomesForCareEvents, refreshOutcomes, reopenOutcomesForCareEvents } from "./outcomes";
import { getOwnedPlant } from "./plants";

export type SimulationResult =
  | { ok: true; readings: number; careEvents: number }
  | { ok: false; error: "disabled" | "not_found" | "failed" };

/** Deletes simulated care events (and their outcomes) and simulated readings. */
async function clearSimulatedData(supabase: SupabaseClient, plantId: string): Promise<boolean> {
  const simulatedEvents = await supabase.from("care_events").select("id").eq("plant_id", plantId).eq("metadata->>simulated", "true");
  if (simulatedEvents.error) return false;
  await deleteOutcomesForCareEvents(plantId, (simulatedEvents.data ?? []).map((e) => e.id as string));

  const clearReadings = await supabase.from("sensor_readings").delete().eq("plant_id", plantId).eq("source", "simulated");
  const clearEvents = await supabase.from("care_events").delete().eq("plant_id", plantId).eq("metadata->>simulated", "true");
  if (clearReadings.error || clearEvents.error) {
    console.error("clearSimulatedData failed", clearReadings.error?.code, clearEvents.error?.code);
    return false;
  }
  return true;
}

/**
 * Replaces a plant's simulated history with a seeded scenario. Runs through
 * the user-scoped client, so RLS guarantees it can only touch the caller's
 * own plant, only insert source = 'simulated', and only delete simulated
 * readings. Device readings are never affected.
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
  if (!(await clearSimulatedData(supabase, plant.id))) return { ok: false, error: "failed" };

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

  await refreshOutcomes(supabase, plant.id, now).catch(() => undefined);
  return { ok: true, readings: timeline.readings.length, careEvents: timeline.careEvents.length };
}

/** Removes all simulated readings and simulated care events for a plant. */
export async function clearSimulation(supabase: SupabaseClient, plantId: string): Promise<boolean> {
  if (!simulatorEnabled()) return false;
  const plant = await getOwnedPlant(supabase, plantId);
  if (!plant) return false;
  return clearSimulatedData(supabase, plant.id);
}

export type FastForwardResult =
  | { ok: true; hours: number; readingsAdded: number; respondedTo: "logged_watering" | "simulated_watering" }
  | { ok: false; error: "disabled" | "not_found" | "has_device_data" | "no_simulation" | "failed" };

/**
 * Demo time travel for a simulated-only plant: shifts its simulated history
 * and care events back by `hours`, then appends `hours` of simulated readings
 * that respond to the most recent watering. If the user just logged a
 * watering, that event is the one the readings respond to; otherwise a
 * simulated watering is added. Everything written is labeled simulated, shifted
 * care events record how far they were moved, and plants with any device
 * readings are refused, so measured history is never rewritten.
 */
export async function fastForward(
  supabase: SupabaseClient,
  userId: string,
  plantId: string,
  hours: number,
  seed: number,
  now = new Date(),
): Promise<FastForwardResult> {
  if (!simulatorEnabled()) return { ok: false, error: "disabled" };
  const plant = await getOwnedPlant(supabase, plantId);
  if (!plant) return { ok: false, error: "not_found" };

  const device = await supabase.from("sensor_readings").select("id", { count: "exact", head: true }).eq("plant_id", plant.id).neq("source", "simulated");
  if (device.error) return { ok: false, error: "failed" };
  if ((device.count ?? 0) > 0) return { ok: false, error: "has_device_data" };

  const [readingsRes, eventsRes] = await Promise.all([
    supabase
      .from("sensor_readings")
      .select("id, recorded_at, soil_moisture_percent, temperature_c, soil_moisture_status, metadata")
      .eq("plant_id", plant.id)
      .eq("source", "simulated")
      .order("recorded_at", { ascending: true })
      .limit(5000),
    supabase.from("care_events").select("id, event_type, occurred_at, metadata").eq("plant_id", plant.id),
  ]);
  if (readingsRes.error || eventsRes.error) return { ok: false, error: "failed" };
  const old = readingsRes.data ?? [];
  if (!old.length) return { ok: false, error: "no_simulation" };

  const shiftMs = hours * 3_600_000;
  const shift = (iso: string) => new Date(Date.parse(iso) - shiftMs).toISOString();
  const lastReadingAt = Date.parse(old.at(-1)!.recorded_at as string);
  const events = eventsRes.data ?? [];

  // A watering logged after the simulated readings ended is the one to respond to.
  const pending = events
    .filter((e) => e.event_type === "watered" && Date.parse(e.occurred_at as string) > lastReadingAt - 30 * 60_000)
    .sort((a, b) => Date.parse(b.occurred_at as string) - Date.parse(a.occurred_at as string))[0];

  const analysis = analyzePlant({
    readings: old.map((r) => ({ recordedAt: r.recorded_at as string, soilMoisturePercent: r.soil_moisture_percent as number | null })),
    careEvents: [],
    now: new Date(lastReadingAt),
  });
  const dryingPerHour = analysis.trend === "declining" && analysis.estimatedChangePercentPerHour !== null ? analysis.estimatedChangePercentPerHour : 0.45;
  const interval = medianIntervalMinutes(old.map((r) => r.recorded_at as string));

  // Outcomes for shifted events are recomputed afterwards from the new
  // timeline; re-opening (not deleting) keeps their assessment links.
  await reopenOutcomesForCareEvents(plant.id, events.map((e) => e.id as string));

  // Assessments move with the timeline so the story stays in order
  // (recommendation → care → response). Server-written records, so the service
  // role does it, scoped to this owned, simulated-only plant.
  const admin = createAdminClient();
  const assessments = await admin.from("plant_assessments").select("id, created_at, evidence").eq("plant_id", plant.id);
  if (assessments.error) return { ok: false, error: "failed" };
  for (const a of assessments.data ?? []) {
    const evidence = { ...((a.evidence as Record<string, unknown>) ?? {}) };
    evidence.time_shifted_by_simulator_hours = Number(evidence.time_shifted_by_simulator_hours ?? 0) + hours;
    const { error } = await admin.from("plant_assessments").update({ created_at: shift(a.created_at as string), evidence }).eq("id", a.id).eq("plant_id", plant.id);
    if (error) return { ok: false, error: "failed" };
  }
  for (const e of events) {
    const metadata = { ...((e.metadata as Record<string, unknown>) ?? {}) };
    metadata.time_shifted_by_simulator_hours = Number(metadata.time_shifted_by_simulator_hours ?? 0) + hours;
    const { error } = await supabase.from("care_events").update({ occurred_at: shift(e.occurred_at as string), metadata }).eq("id", e.id);
    if (error) return { ok: false, error: "failed" };
  }

  const continuationStart = new Date(lastReadingAt - shiftMs);
  let wateringAt: Date;
  let respondedTo: "logged_watering" | "simulated_watering";
  if (pending) {
    wateringAt = new Date(Date.parse(pending.occurred_at as string) - shiftMs);
    respondedTo = "logged_watering";
  } else {
    wateringAt = new Date(continuationStart.getTime() + interval * 60_000);
    respondedTo = "simulated_watering";
    const { error } = await supabase.from("care_events").insert({
      plant_id: plant.id,
      user_id: userId,
      event_type: "watered",
      occurred_at: wateringAt.toISOString(),
      amount_ml: 300,
      notes: "Simulated watering (fast-forward)",
      metadata: { simulated: true, fast_forward: true, seed },
    });
    if (error) return { ok: false, error: "failed" };
  }

  const continuation = generateContinuation({
    start: continuationStart,
    end: now,
    startMoisture: (old.at(-1)!.soil_moisture_percent as number | null) ?? 45,
    dryingPerHour,
    wateringAt,
    intervalMinutes: interval,
    seed,
  });
  const metadata = { simulated: true, fast_forward: true, seed };
  const inserted = await supabase.from("sensor_readings").insert([
    ...old.map((r) => ({
      plant_id: plant.id,
      recorded_at: shift(r.recorded_at as string),
      soil_moisture_percent: r.soil_moisture_percent,
      temperature_c: r.temperature_c,
      soil_moisture_status: r.soil_moisture_status,
      source: "simulated",
      metadata: { ...((r.metadata as Record<string, unknown>) ?? {}), time_shifted_by_simulator_hours: hours },
    })),
    ...continuation.map((r) => ({
      plant_id: plant.id,
      recorded_at: r.recordedAt,
      soil_moisture_percent: r.soilMoisturePercent,
      temperature_c: r.temperatureC,
      soil_moisture_status: r.soilMoistureStatus,
      source: "simulated",
      metadata,
    })),
  ]);
  if (inserted.error) {
    console.error("fastForward: insert failed", inserted.error.code);
    return { ok: false, error: "failed" };
  }
  // Insert first, then remove the originals, so a failure never leaves the plant empty.
  const oldIds = old.map((r) => r.id as number);
  for (let i = 0; i < oldIds.length; i += 200) {
    const { error } = await supabase.from("sensor_readings").delete().eq("source", "simulated").in("id", oldIds.slice(i, i + 200));
    if (error) return { ok: false, error: "failed" };
  }

  await refreshOutcomes(supabase, plant.id, now).catch(() => undefined);
  return { ok: true, hours, readingsAdded: continuation.length, respondedTo };
}
