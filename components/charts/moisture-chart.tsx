"use client";

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CareEvent, ReadingSource, SensorReading } from "@/lib/types/domain";

type Point = { t: number; moisture: number; source: ReadingSource };

const SOURCE_COLOR: Record<ReadingSource, string> = {
  device: "var(--color-forest)",
  simulated: "var(--color-amber)",
  manual: "var(--color-ink-muted)",
};

/**
 * Moisture history. Care events are drawn as vertical markers so the
 * reading response after each intervention is visible at a glance. Each
 * source gets its own series so simulated values never blend into live ones.
 */
export function MoistureChart({ readings, careEvents }: { readings: SensorReading[]; careEvents: CareEvent[] }) {
  const { series, sources, domain } = useMemo(() => {
    const points: Point[] = readings
      .filter((r) => r.soilMoisturePercent != null && Number.isFinite(r.soilMoisturePercent))
      .map((r) => ({ t: Date.parse(r.recordedAt), moisture: r.soilMoisturePercent as number, source: r.source }))
      .filter((p) => Number.isFinite(p.t))
      .sort((a, b) => a.t - b.t);

    const bySource = new Map<ReadingSource, Point[]>();
    for (const p of points) bySource.set(p.source, [...(bySource.get(p.source) ?? []), p]);
    const ts = points.map((p) => p.t);
    return {
      series: bySource,
      sources: [...bySource.keys()],
      domain: ts.length ? ([Math.min(...ts), Math.max(...ts)] as [number, number]) : null,
    };
  }, [readings]);

  const pointCount = [...series.values()].reduce((n, s) => n + s.length, 0);
  if (pointCount < 2 || !domain) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line-strong bg-paper/60 text-center">
        <p className="text-sm font-medium text-ink">Not enough readings to draw a history</p>
        <p className="max-w-sm text-sm text-ink-muted">
          The chart appears after at least two moisture readings from the device or the simulator.
        </p>
      </div>
    );
  }

  const fmt = (t: number) =>
    new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric" }).format(new Date(t));

  return (
    <figure>
      <div className="h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--color-line)" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={domain}
              tickFormatter={fmt}
              tick={{ fill: "var(--color-ink-muted)", fontSize: 11 }}
              stroke="var(--color-line-strong)"
              minTickGap={48}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fill: "var(--color-ink-muted)", fontSize: 11 }}
              stroke="var(--color-line-strong)"
              width={48}
            />
            <Tooltip
              labelFormatter={(t) => fmt(Number(t))}
              formatter={(v) => [`${Number(v).toFixed(1)}%`, "Soil moisture"]}
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-line)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            {careEvents.map((e) => {
              const t = Date.parse(e.occurredAt);
              if (!Number.isFinite(t) || t < domain[0] || t > domain[1]) return null;
              return (
                <ReferenceLine
                  key={e.id}
                  x={t}
                  stroke="var(--color-moss)"
                  strokeDasharray="3 3"
                  label={{ value: e.eventType, position: "insideTopLeft", fill: "var(--color-moss)", fontSize: 11 }}
                />
              );
            })}
            {sources.map((source) => (
              <Line
                key={source}
                data={series.get(source)}
                dataKey="moisture"
                name={source}
                type="monotone"
                stroke={SOURCE_COLOR[source]}
                strokeWidth={2}
                strokeDasharray={source === "simulated" ? "5 4" : undefined}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
        {sources.map((source) => (
          <span key={source} className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-0.5 w-5"
              style={{
                background: source === "simulated" ? undefined : SOURCE_COLOR[source],
                borderTop: source === "simulated" ? `2px dashed ${SOURCE_COLOR[source]}` : undefined,
              }}
            />
            {source === "device" ? "Live device" : source === "simulated" ? "Simulated" : "Manual"}
          </span>
        ))}
        {careEvents.length ? (
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-3 border-l border-dashed border-moss" />
            Care event
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
