import Link from "next/link";
import type { Plant } from "@/lib/types/domain";

/** Shown only when the user has more than one plant. */
export function PlantSwitcher({ plants, selectedId }: { plants: Plant[]; selectedId: string | null }) {
  if (plants.length < 2) return null;
  return (
    <nav aria-label="Choose plant" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
      {plants.map((plant) => {
        const active = plant.id === selectedId;
        return (
          <Link
            key={plant.id}
            href={`/?plant=${plant.id}`}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3 py-1 text-sm transition-colors ${
              active ? "border-forest bg-forest text-paper" : "border-line-strong bg-surface text-ink-muted hover:text-ink"
            }`}
          >
            {plant.name}
          </Link>
        );
      })}
    </nav>
  );
}
