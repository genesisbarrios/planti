import type { TrendSummary } from "@/lib/analysis/analyze";
import type { TrendDirection } from "@/lib/analysis/moisture-trend";
import { ConfidenceMeter } from "@/components/ui/confidence-meter";
import { EmptyState } from "@/components/ui/empty-state";
import { LocalTime } from "@/components/ui/local-time";
import { Panel } from "@/components/ui/panel";

const TREND_LABEL: Record<TrendDirection, string> = {
  declining: "Declining",
  rising: "Rising",
  stable: "Stable",
  unclear: "No clear trend",
  insufficient_data: "Not enough data",
};

/**
 * The deterministic, calculated view of the plant. Shown separately from the
 * model's interpretation so viewers can tell computation from opinion.
 */
export function AnalysisPanel({ analysis }: { analysis: TrendSummary | null }) {
  return (
    <Panel eyebrow={`Calculated · last ${analysis?.windowHours ?? 72} h`} title="Moisture trend">
      {!analysis || analysis.dataFreshness === "none" ? (
        <EmptyState title="Nothing to analyze yet" compact>
          The trend is calculated from stored readings once they arrive.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-serif text-2xl text-ink">{TREND_LABEL[analysis.trend]}</p>
            {analysis.estimatedChangePercentPerHour !== null ? (
              <p className="font-mono text-sm tabular-nums text-ink">
                {analysis.estimatedChangePercentPerHour > 0 ? "+" : "−"}
                {Math.abs(analysis.estimatedChangePercentPerHour).toFixed(2)} pts/h
              </p>
            ) : null}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Row label="Readings used">
              {analysis.trendSampleCount} over {analysis.trendSpanHours} h
            </Row>
            <Row label="Fit (R²)">{analysis.rSquared ?? "—"}</Row>
            <Row label="Last watering">
              {analysis.lastWateringAt ? <LocalTime iso={analysis.lastWateringAt} /> : "None logged"}
            </Row>
            <Row label="Data">{analysis.dataFreshness === "fresh" ? "Fresh" : "Stale"}</Row>
          </dl>

          <div className="space-y-1.5">
            <ConfidenceMeter confidence={analysis.confidence} />
            {analysis.confidenceReasons.length ? (
              <p className="text-xs text-ink-muted">{analysis.confidenceReasons.join(" · ")}</p>
            ) : null}
          </div>

          {analysis.limitations.length ? (
            <ul className="space-y-1 border-t border-line pt-3 text-xs leading-relaxed text-ink-muted">
              {analysis.limitations.map((l) => (
                <li key={l} className="flex gap-2">
                  <span aria-hidden="true">–</span>
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-[0.6875rem] text-ink-muted">Thresholds are data-quality heuristics, not plant requirements.</p>
        </div>
      )}
    </Panel>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[0.6875rem] uppercase tracking-[0.12em] text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-mono text-[0.8125rem] text-ink">{children}</dd>
    </div>
  );
}
