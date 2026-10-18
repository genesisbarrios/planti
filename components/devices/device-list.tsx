import { LiveIndicator } from "@/components/ui/live-indicator";
import { LocalTime } from "@/components/ui/local-time";
import { formatAge } from "@/lib/format";
import type { DeviceStatus } from "@/lib/services/dashboard";

type Props = {
  devices: DeviceStatus[];
  onlineThresholdMinutes: number;
  ageMinutesById: Record<string, number | null>;
  removeAction: (deviceId: string) => Promise<void>;
};

export function DeviceList({ devices, onlineThresholdMinutes, ageMinutesById, removeAction }: Props) {
  return (
    <ul className="divide-y divide-line">
      {devices.map((device) => (
        <li key={device.id} className="space-y-3 py-4 first:pt-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink">{device.deviceName ?? "Unnamed device"}</p>
              <p className="break-all font-mono text-xs text-ink-muted">{device.id}</p>
            </div>
            <LiveIndicator connection={device.connection} />
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <Item label="Source">Hardware</Item>
            <Item label="Firmware">{device.firmwareVersion ?? "Not reported"}</Item>
            <Item label="Latest reading"><LocalTime iso={device.latestReadingAt} /></Item>
            <Item label="Last upload"><LocalTime iso={device.lastSeenAt} /></Item>
          </dl>

          {device.connection === "stale" ? (
            <p className="rounded-lg bg-clay-soft px-3 py-2 text-sm text-clay">
              No reading for {formatAge(ageMinutesById[device.id] ?? null).replace(" ago", "")}, longer than the{" "}
              {onlineThresholdMinutes}-minute threshold. Check power, Wi-Fi and the serial log on the device.
            </p>
          ) : device.connection === "never_reported" ? (
            <p className="rounded-lg bg-sunken px-3 py-2 text-sm text-ink-muted">
              Paired, but no reading has arrived yet. A device shows as online only after it uploads.
            </p>
          ) : null}

          <form action={removeAction.bind(null, device.id)}>
            <button type="submit" className="text-sm text-ink-muted underline-offset-2 hover:text-clay hover:underline">
              Remove device
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[0.6875rem] uppercase tracking-[0.12em] text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-ink">{children}</dd>
    </div>
  );
}
