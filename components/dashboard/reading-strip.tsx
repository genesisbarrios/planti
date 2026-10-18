import { LiveIndicator } from "@/components/ui/live-indicator";
import { SourceBadge } from "@/components/ui/source-badge";
import { formatAge, formatPercent, formatTemperature, formatTimestamp } from "@/lib/format";
import type { DashboardView } from "@/lib/services/dashboard";

/** The instrument row: current readings, their age, source and device link. */
export function ReadingStrip({ view }: { view: DashboardView }) {
  const { latestReading, freshness, device } = view;
  const stale = freshness.freshness === "stale";

  return (
    <section aria-label="Current readings" className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <LiveIndicator connection={device?.connection ?? null} />
        <SourceBadge source={latestReading?.source ?? null} />
      </div>

      <dl className="grid grid-cols-2 gap-px bg-line lg:grid-cols-4">
        <Cell label="Soil moisture">
          <Value>{formatPercent(latestReading?.soilMoisturePercent)}</Value>
          <Detail>{latestReading ? statusLabel(latestReading.soilMoistureStatus) : "Waiting for a first reading"}</Detail>
        </Cell>
        <Cell label="Temperature">
          <Value>{formatTemperature(latestReading?.temperatureC)}</Value>
          <Detail>
            {!latestReading ? "If the sensor reports it" : latestReading.temperatureC == null ? "Not reported by sensor" : "Soil sensor"}
          </Detail>
        </Cell>
        <Cell label="Last reading">
          <Value small>{formatAge(freshness.ageMinutes)}</Value>
          <Detail>{latestReading ? formatTimestamp(latestReading.recordedAt) : "—"}</Detail>
        </Cell>
        <Cell label="Device">
          <Value small>{device?.deviceName ?? (device ? "Unnamed device" : "Not paired")}</Value>
          <Detail>{device?.firmwareVersion ? `Firmware ${device.firmwareVersion}` : "No firmware reported"}</Detail>
        </Cell>
      </dl>

      {stale ? (
        <p role="status" className="border-t border-line bg-clay-soft px-5 py-3 text-sm text-clay">
          No new reading for {formatAge(freshness.ageMinutes).replace(" ago", "")}. Values above may no longer reflect the soil;
          assessments will treat this data as stale.
        </p>
      ) : null}
    </section>
  );
}

function statusLabel(status: string): string {
  return status === "unknown" ? "Status unknown" : `Reported ${status}`;
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface px-5 py-4">
      <dt className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-ink-muted">{label}</dt>
      <dd className="mt-2">{children}</dd>
    </div>
  );
}

function Value({ children, small = false }: { children: React.ReactNode; small?: boolean }) {
  return (
    <span className={`block font-mono tabular-nums text-ink ${small ? "text-lg" : "text-3xl tracking-tight"}`}>
      {children}
    </span>
  );
}

function Detail({ children }: { children: React.ReactNode }) {
  return <span className="mt-1 block text-xs text-ink-muted">{children}</span>;
}
