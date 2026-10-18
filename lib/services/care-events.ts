import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CareEvent } from "@/lib/types/domain";
import type { CareEventInput } from "@/lib/validation/care-event";
import { CARE_EVENT_COLUMNS, toCareEvent, type CareEventRow } from "./mappers";
import { refreshOutcomes } from "./outcomes";
import { getOwnedPlant } from "./plants";

export type LogCareResult = { ok: true; event: CareEvent } | { ok: false; error: "not_found" | "failed" };

/**
 * Logs care for a plant the caller owns (RLS enforces this again on insert),
 * then opens an outcome record for waterings so later readings can be
 * compared against the moment of care.
 */
export async function logCareEvent(supabase: SupabaseClient, userId: string, input: CareEventInput): Promise<LogCareResult> {
  const plant = await getOwnedPlant(supabase, input.plantId);
  if (!plant) return { ok: false, error: "not_found" };

  const { data, error } = await supabase
    .from("care_events")
    .insert({
      plant_id: plant.id,
      user_id: userId,
      event_type: input.eventType,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      amount_ml: input.amountMl ?? null,
      notes: input.notes || null,
    })
    .select(CARE_EVENT_COLUMNS)
    .single();
  if (error || !data) {
    console.error("logCareEvent: insert failed", error?.code);
    return { ok: false, error: "failed" };
  }

  const event = toCareEvent(data as CareEventRow);
  if (event.eventType === "watered") {
    try {
      await refreshOutcomes(supabase, plant.id);
    } catch (e) {
      // The care event is saved; the outcome will be created on the next refresh.
      console.error("logCareEvent: outcome refresh failed", e instanceof Error ? e.message : "unknown");
    }
  }
  return { ok: true, event };
}
