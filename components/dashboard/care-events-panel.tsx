import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { formatTimestamp } from "@/lib/format";
import type { CareEvent, CareEventType } from "@/lib/types/domain";

const LABELS: Record<CareEventType, string> = {
  watered: "Watered",
  fertilized: "Fertilized",
  moved: "Moved",
  repotted: "Changed soil or pot",
  other: "Other care",
};

export function CareEventsPanel({ events }: { events: CareEvent[] }) {
  return (
    <Panel eyebrow="Care log" title="Recent care">
      {events.length ? (
        <ol className="divide-y divide-line">
          {events.map((event) => (
            <li key={event.id} className="flex items-baseline justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm font-medium text-ink">
                  {LABELS[event.eventType]}
                  {event.amountMl != null ? <span className="font-normal text-ink-muted"> · {event.amountMl} ml</span> : null}
                </p>
                {event.notes ? <p className="mt-0.5 text-sm text-ink-muted">{event.notes}</p> : null}
              </div>
              <time dateTime={event.occurredAt} className="shrink-0 font-mono text-xs text-ink-muted">
                {formatTimestamp(event.occurredAt)}
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState title="Nothing logged yet" compact>
          Log watering and other care so Planti can compare readings before and after each one.
        </EmptyState>
      )}
    </Panel>
  );
}
