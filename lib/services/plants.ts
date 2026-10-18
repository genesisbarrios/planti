import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlantInput } from "@/lib/validation/plant";
import { uuidSchema } from "@/lib/validation/plant";
import { PLANT_COLUMNS, toPlant, type PlantRow } from "./mappers";

/**
 * Plant data access. Every function takes the *user-scoped* Supabase client,
 * so RLS limits results to the signed-in user's plants.
 */

export async function listPlants(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("plants").select(PLANT_COLUMNS).order("created_at", { ascending: true });
  if (error) throw new Error("Could not load plants");
  return (data as PlantRow[]).map(toPlant);
}

/**
 * Returns the plant if it exists AND belongs to the caller; null otherwise.
 * Use this as the ownership check before any service-role write.
 */
export async function getOwnedPlant(supabase: SupabaseClient, plantId: string) {
  if (!uuidSchema.safeParse(plantId).success) return null;
  const { data, error } = await supabase.from("plants").select(PLANT_COLUMNS).eq("id", plantId).maybeSingle();
  if (error) throw new Error("Could not load plant");
  return data ? toPlant(data as PlantRow) : null;
}

function toRow(input: PlantInput) {
  return {
    name: input.name,
    species: input.species,
    location: input.location,
    light_conditions: input.lightConditions,
    pot_notes: input.potNotes,
    notes: input.notes,
    planted_at: input.plantedAt,
    care_preferences: input.carePreferences,
  };
}

export async function createPlant(supabase: SupabaseClient, userId: string, input: PlantInput) {
  const { data, error } = await supabase
    .from("plants")
    .insert({ ...toRow(input), user_id: userId })
    .select("id")
    .single();
  if (error) throw new Error("Could not create plant");
  return data.id as string;
}

export async function updatePlant(supabase: SupabaseClient, plantId: string, input: PlantInput) {
  const { data, error } = await supabase.from("plants").update(toRow(input)).eq("id", plantId).select("id");
  if (error) throw new Error("Could not update plant");
  return (data ?? []).length > 0;
}
