import type { Metadata } from "next";
import { PlantForm } from "@/components/plants/plant-form";
import { requireUser } from "@/lib/auth";
import { createPlantAction } from "../actions";

export const metadata: Metadata = { title: "Add plant" };

export default async function NewPlantPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display font-semibold text-3xl text-ink">Add a plant</h1>
        <p className="mt-1 text-sm text-ink-muted">Only the name is required. Everything else helps Planti give more specific advice.</p>
      </div>
      <div className="rounded-card border border-line bg-surface p-5 sm:p-8">
        <PlantForm action={createPlantAction} submitLabel="Add plant" />
      </div>
    </div>
  );
}
