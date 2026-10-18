import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { LocalTime } from "@/components/ui/local-time";
import type { Assessment, Confidence } from "@/lib/types/domain";

export function AssessmentPanel({ assessment, actions }: { assessment: Assessment | null; actions?: React.ReactNode }) {
  return (
    <Panel eyebrow="Current assessment" title="What Planti thinks" actions={actions}>
      {assessment ? (
        <div className="space-y-5">
          <p className="font-serif text-[1.0625rem] leading-relaxed text-ink">{assessment.assessment}</p>

          <ConfidenceMeter confidence={assessment.confidence} />

          {assessment.recommendedAction ? (
            <div className="rounded-lg border border-forest/20 bg-moss-soft/60 px-4 py-3">
              <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-forest">Next step</p>
              <p className="mt-1 text-sm leading-relaxed text-ink">{assessment.recommendedAction}</p>
            </div>
          ) : null}

          <p className="text-xs text-ink-muted">
            {assessment.aiModel ? `Interpreted by ${assessment.aiModel}` : "Deterministic analysis only"} ·{" "}
            <LocalTime iso={assessment.createdAt} />
          </p>
        </div>
      ) : (
        <EmptyState title="No assessment yet" compact>
          Planti assesses a plant from its recorded readings and care history. Once there is data, run an assessment to see
          the trend, the reasoning and a suggested next step.
        </EmptyState>
      )}
    </Panel>
  );
}

const LEVELS: Confidence[] = ["low", "medium", "high"];

function ConfidenceMeter({ confidence }: { confidence: Confidence }) {
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
