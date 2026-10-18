import { ConfidenceMeter } from "@/components/ui/confidence-meter";
import { EmptyState } from "@/components/ui/empty-state";
import { LocalTime } from "@/components/ui/local-time";
import { Panel } from "@/components/ui/panel";
import type { Assessment } from "@/lib/types/domain";
import { AssessmentRunner } from "./assessment-runner";

const TREND_WORD: Record<string, string> = {
  declining: "declining",
  rising: "rising",
  stable: "stable",
  unclear: "no clear trend",
  insufficient_data: "not enough data",
};

/**
 * The model's interpretation of the calculated evidence. Everything here is
 * labeled as interpretation and linked back to the numbers it was based on.
 */
export function AssessmentPanel({ assessment, plantId }: { assessment: Assessment | null; plantId: string | null }) {
  const simulated = assessment?.basis?.sources.includes("simulated") ?? false;

  return (
    <Panel eyebrow="Interpreted · Nemotron" title="What Planti thinks">
      <div className="space-y-5">
        {plantId ? <AssessmentRunner plantId={plantId} /> : null}

        {assessment ? (
          <article className="space-y-4">
            {simulated ? (
              <p className="w-fit rounded-full border border-amber/30 bg-amber-soft px-2.5 py-0.5 text-xs font-medium text-amber">
                Based on simulated readings
              </p>
            ) : null}
            <p className="font-serif text-[1.0625rem] leading-relaxed text-ink">{assessment.assessment}</p>

            {assessment.recommendedAction ? (
              <div className="rounded-lg border border-forest/20 bg-moss-soft/60 px-4 py-3">
                <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-forest">Next step</p>
                <p className="mt-1 text-sm leading-relaxed text-ink">{assessment.recommendedAction}</p>
              </div>
            ) : null}

            <div className="space-y-1">
              <ConfidenceMeter confidence={assessment.confidence} />
              {assessment.confidenceCapped ? (
                <p className="text-xs text-ink-muted">Lowered to match the calculated confidence; the model claimed more certainty than the data supports.</p>
              ) : null}
            </div>

            <details className="group rounded-lg border border-line">
              <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-medium text-ink hover:bg-sunken">
                Why this recommendation?
              </summary>
              <div className="space-y-4 border-t border-line px-4 py-4 text-sm">
                {assessment.basis ? (
                  <Section title="Calculated evidence used">
                    <p className="text-ink">
                      Trend {TREND_WORD[assessment.basis.trend] ?? assessment.basis.trend}
                      {assessment.basis.estimatedChangePercentPerHour !== null
                        ? ` at ${assessment.basis.estimatedChangePercentPerHour.toFixed(2)} pts/h`
                        : ""}{" "}
                      from {assessment.basis.trendSampleCount} readings over {assessment.basis.trendSpanHours} h; data{" "}
                      {assessment.basis.dataFreshness}; calculated confidence {assessment.basis.calculatedConfidence}.
                    </p>
                  </Section>
                ) : null}
                <List title="Facts the model cited" items={assessment.observedFacts} />
                {assessment.interpretation ? (
                  <Section title="Interpretation">
                    <p className="leading-relaxed text-ink">{assessment.interpretation}</p>
                  </Section>
                ) : null}
                <List title="Reasons for the next step" items={assessment.reasons} />
                <List title="Limitations" items={assessment.limitations} />
                {assessment.followUpObservation ? (
                  <Section title="What would test this">
                    <p className="leading-relaxed text-ink">{assessment.followUpObservation}</p>
                  </Section>
                ) : null}
              </div>
            </details>

            <p className="text-xs text-ink-muted">
              {assessment.aiModel ? `Interpreted by ${assessment.aiModel}` : "Deterministic analysis only"} · <LocalTime iso={assessment.createdAt} />
              {assessment.retriedWithoutReasoning ? " · answered without extended reasoning after the first attempt ran out of budget" : ""}
            </p>
          </article>
        ) : (
          <EmptyState title="No assessment yet" compact>
            Planti calculates the trend from stored readings, then asks Nemotron to interpret that evidence and suggest one next
            step. The model never sees raw readings one by one, and it can&apos;t claim more confidence than the data supports.
          </EmptyState>
        )}
      </div>
    </Panel>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-muted">{title}</p>
      {children}
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <Section title={title}>
      <ul className="space-y-1 text-ink">
        {items.map((item) => (
          <li key={item} className="flex gap-2 leading-relaxed">
            <span aria-hidden="true" className="text-ink-muted">–</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
