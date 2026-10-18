import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_ANALYSIS_CONFIG } from "@/lib/analysis/config";
import { planOutcomes } from "@/lib/analysis/outcome-plan";
import { cleanReadings } from "@/lib/analysis/readings";
import { isConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InterventionOutcomeKind } from "@/lib/types/domain";

/** Waterings older than this are not (re)evaluated. */
const LOOKBACK_DAYS = 14;

/**
 * Brings a plant's intervention outcomes up to date with its readings.
 * Cheap when there is nothing to do (two queries), so it can run on page
 * loads, after care is logged, and after readings arrive, with no scheduler.
 *
 * The caller must already have verified that `plantId` belongs to the user
 * of `userClient`; reads go through that client (RLS), and only the outcome
 * writes use the service role, because users cannot write outcomes directly.
 */
export async function refreshOutcomes(userClient: SupabaseClient, plantId: string, now = new Date()) {
  if (!isConfigured("supabaseAdmin")) return { inserted: 0, updated: 0 };
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000).toISOString();

  const [wateringsRes, outcomesRes] = await Promise.all([
    userClient
      .from("care_events")
      .select("id, occurred_at")
      .eq("plant_id", plantId)
      .eq("event_type", "watered")
      .gte("occurred_at", since)
      .lte("occurred_at", now.toISOString())
      .order("occurred_at", { ascending: true }),
    userClient.from("intervention_outcomes").select("id, care_event_id, outcome, assessment_id").eq("plant_id", plantId),
  ]);
  if (wateringsRes.error || outcomesRes.error) throw new Error("Could not load care outcomes");

  const waterings = (wateringsRes.data ?? []).map((w) => ({ id: w.id as string, occurredAt: w.occurred_at as string }));
  const existing = (outcomesRes.data ?? []).map((o) => ({
    id: o.id as string,
    careEventId: o.care_event_id as string | null,
    outcome: o.outcome as InterventionOutcomeKind,
    assessmentId: o.assessment_id as string | null,
  }));
  const finalized = new Set(existing.filter((o) => o.outcome !== "pending_observation").map((o) => o.careEventId));
  const open = waterings.filter((w) => !finalized.has(w.id));
  if (!open.length) return { inserted: 0, updated: 0 };

  const config = DEFAULT_ANALYSIS_CONFIG;
  const from = new Date(Date.parse(open[0].occurredAt) - config.interventionBeforeHours * 3_600_000).toISOString();
  const [readingsRes, assessmentsRes] = await Promise.all([
    userClient
      .from("sensor_readings")
      .select("recorded_at, soil_moisture_percent, source")
      .eq("plant_id", plantId)
      .gte("recorded_at", from)
      .lte("recorded_at", now.toISOString())
      .order("recorded_at", { ascending: true })
      .limit(5000),
    userClient.from("plant_assessments").select("id, created_at").eq("plant_id", plantId).gte("created_at", since),
  ]);
  if (readingsRes.error || assessmentsRes.error) throw new Error("Could not load readings for outcomes");

  const { points } = cleanReadings(
    (readingsRes.data ?? []).map((r) => ({
      recordedAt: r.recorded_at as string,
      soilMoisturePercent: r.soil_moisture_percent as number | null,
      source: r.source as string,
    })),
  );
  const actions = planOutcomes({
    waterings: open,
    existing,
    points,
    assessments: (assessmentsRes.data ?? []).map((a) => ({ id: a.id as string, createdAt: a.created_at as string })),
    now,
    config,
  });
  if (!actions.length) return { inserted: 0, updated: 0 };

  const admin = createAdminClient();
  const inserts = actions.filter((a) => a.kind === "insert").map((a) => ({ ...a.row, plant_id: plantId }));
  if (inserts.length) {
    const { error } = await admin.from("intervention_outcomes").insert(inserts);
    if (error) console.error("refreshOutcomes: insert failed", error.code);
  }
  for (const action of actions) {
    if (action.kind !== "update") continue;
    // Guard: only a still-pending record for this plant may be updated.
    const { error } = await admin
      .from("intervention_outcomes")
      .update(action.row)
      .eq("id", action.id)
      .eq("plant_id", plantId)
      .eq("outcome", "pending_observation");
    if (error) console.error("refreshOutcomes: update failed", error.code);
  }
  return { inserted: inserts.length, updated: actions.length - inserts.length };
}

/** Removes outcome records for care events that are about to be deleted or rewritten. */
export async function deleteOutcomesForCareEvents(plantId: string, careEventIds: string[]) {
  if (!careEventIds.length || !isConfigured("supabaseAdmin")) return;
  const { error } = await createAdminClient()
    .from("intervention_outcomes")
    .delete()
    .eq("plant_id", plantId)
    .in("care_event_id", careEventIds);
  if (error) console.error("deleteOutcomesForCareEvents failed", error.code);
}

/**
 * Re-opens outcomes for care events whose timing is being rewritten by the
 * simulator, keeping their assessment links; refreshOutcomes recomputes them.
 */
export async function reopenOutcomesForCareEvents(plantId: string, careEventIds: string[]) {
  if (!careEventIds.length || !isConfigured("supabaseAdmin")) return;
  const { error } = await createAdminClient()
    .from("intervention_outcomes")
    .update({ outcome: "pending_observation", explanation: "Re-evaluating after simulated time shift." })
    .eq("plant_id", plantId)
    .in("care_event_id", careEventIds);
  if (error) console.error("reopenOutcomesForCareEvents failed", error.code);
}
