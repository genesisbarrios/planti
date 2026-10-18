"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { clearSimulation, fastForward, runScenario } from "@/lib/services/simulation";
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

const fastForwardSchema = z.object({
  plantId: uuidSchema,
  hours: z.coerce.number().int().min(3).max(24),
});

export async function fastForwardAction(_prev: SimulationState, formData: FormData): Promise<SimulationState> {
  const user = await requireUser();
  const parsed = fastForwardSchema.safeParse({ plantId: formData.get("plantId"), hours: formData.get("hours") });
  if (!parsed.success) return { error: "Choose between 3 and 24 hours." };

  const result = await fastForward(await createClient(), user.id, parsed.data.plantId, parsed.data.hours, 20261018 + parsed.data.hours);
  revalidatePath("/");
  if (!result.ok) {
    return {
      error: {
        disabled: "The simulator is turned off on this server.",
        not_found: "Plant not found.",
        has_device_data: "This plant has measured readings from a device. Fast-forward only works on simulated-only plants.",
        no_simulation: "Load a scenario first.",
        failed: "Could not fast-forward. Try again.",
      }[result.error],
    };
  }
  return {
    message: `Simulated ${result.hours} hours: ${result.readingsAdded} new simulated readings responding to ${
      result.respondedTo === "logged_watering" ? "your logged watering" : "a simulated watering"
    }.`,
  };
}
