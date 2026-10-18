import type { Plant } from "@/lib/types/domain";

export function PlantHeader({ plant }: { plant: Plant | null }) {
  if (!plant) {
    return (
      <div>
        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-muted">Selected plant</p>
        <h1 className="mt-1 font-serif text-3xl leading-tight text-ink sm:text-4xl">No plant yet</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">
          Add a plant to start building its memory: readings, care events and how it responds over time.
        </p>
      </div>
    );
  }

  const details = [plant.location, plant.lightConditions].filter(Boolean);
  return (
    <div>
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-muted">Selected plant</p>
      <h1 className="mt-1 font-serif text-3xl leading-tight text-ink sm:text-4xl">{plant.name}</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        {plant.species ? <span className="font-serif italic">{plant.species}</span> : <span>Species not set</span>}
        {details.map((detail) => (
          <span key={detail}>
            <span aria-hidden="true" className="mx-2 text-line-strong">/</span>
            {detail}
          </span>
        ))}
      </p>
    </div>
  );
}
