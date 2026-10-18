import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth";
import { listPlants } from "@/lib/services/plants";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Plants" };

export default async function PlantsPage() {
  await requireUser();
  const plants = await listPlants(await createClient());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-3xl text-ink">Plants</h1>
          <p className="mt-1 text-sm text-ink-muted">Each plant keeps its own profile, readings and care memory.</p>
        </div>
        <ButtonLink href="/plants/new">Add plant</ButtonLink>
      </div>

      {plants.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plants.map((plant) => (
            <li key={plant.id}>
              <Link
                href={`/plants/${plant.id}`}
                className="block h-full rounded-card border border-line bg-surface px-5 py-4 transition-colors hover:border-line-strong hover:bg-paper"
              >
                <p className="font-display text-lg text-ink">{plant.name}</p>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {plant.species ? <span>{plant.species}</span> : "Species not set"}
                </p>
                {plant.location ? <p className="mt-2 text-xs text-ink-muted">{plant.location}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No plants yet" action={<ButtonLink href="/plants/new">Add your first plant</ButtonLink>}>
          Start with the plant you&apos;ll connect the sensor to. You can add species and care notes now or later.
        </EmptyState>
      )}
    </div>
  );
}
