"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { deleteDevice, provisionDevice } from "@/lib/services/devices";
import { createPlant, updatePlant } from "@/lib/services/plants";
import { createClient } from "@/lib/supabase/server";
import { plantInputFromForm, uuidSchema } from "@/lib/validation/plant";

export type PlantFormState = { error?: string; fieldErrors?: Record<string, string>; saved?: boolean };

function fieldErrors(issues: z.core.$ZodIssue[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join(".");
    out[key] ??= issue.message;
  }
  return out;
}

export async function createPlantAction(_prev: PlantFormState, formData: FormData): Promise<PlantFormState> {
  const user = await requireUser();
  const parsed = plantInputFromForm(formData);
  if (!parsed.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };

  let plantId: string;
  try {
    plantId = await createPlant(await createClient(), user.id, parsed.data);
  } catch {
    return { error: "Could not save the plant. Try again." };
  }
  revalidatePath("/", "layout");
  redirect(`/plants/${plantId}`);
}

export async function updatePlantAction(plantId: string, _prev: PlantFormState, formData: FormData): Promise<PlantFormState> {
  await requireUser();
  if (!uuidSchema.safeParse(plantId).success) return { error: "Unknown plant." };
  const parsed = plantInputFromForm(formData);
  if (!parsed.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };

  try {
    const updated = await updatePlant(await createClient(), plantId, parsed.data);
    if (!updated) return { error: "Plant not found." };
  } catch {
    return { error: "Could not save changes. Try again." };
  }
  revalidatePath("/", "layout");
  return { saved: true };
}

export type ProvisionState = { error?: string; credential?: string; deviceId?: string };

const deviceNameSchema = z
  .string()
  .trim()
  .max(120)
  .transform((v) => (v === "" ? null : v));

export async function provisionDeviceAction(plantId: string, _prev: ProvisionState, formData: FormData): Promise<ProvisionState> {
  await requireUser();
  const name = deviceNameSchema.safeParse(formData.get("deviceName") ?? "");
  if (!name.success) return { error: "Keep the device name under 120 characters." };

  const result = await provisionDevice(await createClient(), plantId, name.data);
  if (!result.ok) {
    const messages = {
      not_found: "Plant not found.",
      not_configured: "Device provisioning needs DEVICE_INGESTION_SECRET and SUPABASE_SERVICE_ROLE_KEY on the server.",
      failed: "Could not create the device. Try again.",
    };
    return { error: messages[result.error] };
  }
  revalidatePath(`/plants/${plantId}`);
  return { credential: result.credential, deviceId: result.deviceId };
}

export async function deleteDeviceAction(plantId: string, deviceId: string) {
  await requireUser();
  if (!uuidSchema.safeParse(deviceId).success) return;
  await deleteDevice(await createClient(), deviceId);
  revalidatePath(`/plants/${plantId}`);
}
