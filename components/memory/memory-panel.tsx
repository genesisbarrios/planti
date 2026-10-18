import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { formatTimestamp } from "@/lib/format";
import type { InterventionOutcome, InterventionOutcomeKind } from "@/lib/types/domain";

const OUTCOME_LABEL: Record<InterventionOutcomeKind, { label: string; className: string }> = {
  pending_observation: { label: "Waiting for readings", className: "bg-sunken text-ink-muted" },
  moisture_increase_observed: { label: "Moisture rose afterwards", className: "bg-moss-soft text-forest" },
  no_measurable_change: { label: "No measurable change", className: "bg-amber-soft text-amber" },
  inconclusive: { label: "Inconclusive", className: "bg-sunken text-ink-muted" },
};

/**
 * Plant Memory summary: how past care was followed by measured changes.
 * Outcomes describe observed responses, never proven causes.
 */
export function MemoryPanel({ outcomes }: { outcomes: InterventionOutcome[] }) {
  return (
    <Panel eyebrow="Plant memory" title="What happened after care">
      {outcomes.length ? (
        <ol className="relative space-y-5 border-l border-line pl-5">
          {outcomes.map((o) => {
            const style = OUTCOME_LABEL[o.outcome];
            return (
              <li key={o.id} className="relative">
                <span aria-hidden="true" className="absolute -left-[1.6rem] top-1.5 h-2 w-2 rounded-full bg-moss" />
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}>{style.label}</span>
                  <time dateTime={o.observedAt} className="font-mono text-xs text-ink-muted">
                    {formatTimestamp(o.observedAt)}
                  </time>
                </div>
                {o.explanation ? <p className="mt-1.5 text-sm leading-relaxed text-ink">{o.explanation}</p> : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState title="No memory yet">
          Planti builds memory by comparing readings before and after each care event. After you log watering and new readings
          arrive, the observed response appears here, along with how confident Planti is in it.
        </EmptyState>
      )}
    </Panel>
  );
}
