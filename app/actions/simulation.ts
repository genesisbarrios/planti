"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { clearSimulation, runScenario } from "@/lib/services/simulation";
import { isScenarioId } from "@/lib/simulation/scenarios";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/plant";

export type SimulationState = { error?: string; message?: string };

const inputSchema = z.object({
  plantId: uuidSchema,
  scenario: z.string().refine(isScenarioId, "Unknown scenario"),
  seed: z.coerce.number().int().min(1).max(2_147_483_647),
});

export async function runScenarioAction(_prev: SimulationState, formData: FormData): Promise<SimulationState> {
  const user = await requireUser();
  const parsed = inputSchema.safeParse({
    plantId: formData.get("plantId"),
    scenario: formData.get("scenario"),
    seed: formData.get("seed") || 20261018,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { plantId, scenario, seed } = parsed.data;
  if (!isScenarioId(scenario)) return { error: "Unknown scenario" };

  const result = await runScenario(await createClient(), user.id, plantId, scenario, seed);
  if (!result.ok) {
    return {
      error: {
        disabled: "The simulator is turned off on this server.",
        not_found: "Plant not found.",
        failed: "Could not write the simulated timeline. Try again.",
      }[result.error],
    };
  }
  revalidatePath("/");
  return {
    message: `Loaded ${result.readings} simulated readings${result.careEvents ? ` and ${result.careEvents} simulated care event` : ""}.`,
  };
}

export async function clearSimulationAction(_prev: SimulationState, formData: FormData): Promise<SimulationState> {
  await requireUser();
  const plantId = uuidSchema.safeParse(formData.get("plantId"));
  if (!plantId.success) return { error: "Unknown plant." };
  const ok = await clearSimulation(await createClient(), plantId.data);
  revalidatePath("/");
  return ok ? { message: "Simulated data cleared. Measured readings were not touched." } : { error: "Could not clear simulated data." };
}
