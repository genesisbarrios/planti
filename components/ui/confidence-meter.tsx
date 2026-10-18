import type { Confidence } from "@/lib/types/domain";

const LEVELS: Confidence[] = ["low", "medium", "high"];

export function ConfidenceMeter({ confidence }: { confidence: Confidence }) {
  const filled = LEVELS.indexOf(confidence) + 1;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-muted">Confidence</span>
      <span className="flex gap-1" aria-hidden="true">
        {LEVELS.map((level, i) => (
          <span key={level} className={`h-1.5 w-7 rounded-full ${i < filled ? "bg-forest" : "bg-line"}`} />
        ))}
      </span>
      <span className="text-sm capitalize text-ink">{confidence}</span>
    </div>
  );
}
