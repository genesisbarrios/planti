import type { DeviceConnection } from "@/lib/analysis/freshness";

const STATES: Record<DeviceConnection | "none", { label: string; dot: string; live: boolean }> = {
  online: { label: "Receiving readings", dot: "bg-neon ring-1 ring-forest/40", live: true },
  stale: { label: "Stopped reporting", dot: "bg-clay", live: false },
  never_reported: { label: "No readings yet", dot: "bg-line-strong", live: false },
  none: { label: "No device", dot: "bg-line-strong", live: false },
};

export function LiveIndicator({ connection }: { connection: DeviceConnection | null }) {
  const state = STATES[connection ?? "none"];
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-muted">
      <span className="relative inline-flex h-2.5 w-2.5" aria-hidden="true">
        {state.live ? <span className={`live-ring absolute inset-0 rounded-full ${state.dot}`} /> : null}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${state.dot}`} />
      </span>
      {state.label}
    </span>
  );
}
