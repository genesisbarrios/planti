import { EmptyState } from "@/components/ui/empty-state";
import { LocalTime } from "@/components/ui/local-time";
import { Panel } from "@/components/ui/panel";
import type { TimelineEntry } from "@/lib/memory/timeline";

const TONE_DOT: Record<TimelineEntry["tone"], string> = {
  neutral: "bg-line-strong",
  positive: "bg-moss",
  caution: "bg-amber",
  warning: "bg-clay",
};

const BASIS_LABEL: Record<TimelineEntry["basis"], string> = {
  logged: "Logged",
  calculated: "Calculated from readings",
  deterministic: "Recorded outcome",
  model: "Model interpretation",
};

/**
 * Plant Memory: a narrative built only from calculated evidence, and the
 * timeline that connects care to what the readings did afterwards.
 * Responses are observations, never proof of cause.
 */
export function MemoryPanel({ narrative, entries }: { narrative: string[]; entries: TimelineEntry[] }) {
  return (
    <Panel eyebrow="Plant memory" title="What this plant's history shows">
      {narrative.length === 0 && entries.length === 0 ? (
        <EmptyState title="No memory yet">
          Planti builds memory by comparing readings before and after each care event. Once readings arrive and you log care,
          the story of how this plant responds appears here.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {narrative.length ? (
            <p className="font-serif text-[1.0625rem] leading-relaxed text-ink">{narrative.join(" ")}</p>
          ) : null}

          {entries.length ? (
            <ol className="relative space-y-4 border-l border-line pl-5" aria-label="Timeline, newest first">
              {entries.map((entry) => (
                <li key={entry.id} className="relative">
                  <span aria-hidden="true" className={`absolute -left-[1.53rem] top-1.5 h-2 w-2 rounded-full ring-4 ring-surface ${TONE_DOT[entry.tone]}`} />
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <p className="text-sm font-medium text-ink">{entry.title}</p>
                    <LocalTime iso={entry.at} className="font-mono text-xs text-ink-muted" />
                    <span className="text-[0.6875rem] uppercase tracking-[0.1em] text-ink-muted">{BASIS_LABEL[entry.basis]}</span>
                  </div>
                  {entry.detail ? <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-muted">{entry.detail}</p> : null}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      )}
    </Panel>
  );
}
