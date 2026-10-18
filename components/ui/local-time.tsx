"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Renders a timestamp in the viewer's own time zone. The server renders UTC,
 * then the client swaps in local time after hydration, avoiding mismatches.
 */
export function LocalTime({ iso, className }: { iso: string | null | undefined; className?: string }) {
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);
  if (!iso) return <span className={className}>—</span>;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return <span className={className}>—</span>;

  const text = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: isClient ? undefined : "UTC",
    timeZoneName: isClient ? undefined : "short",
  }).format(date);

  return (
    <time dateTime={iso} className={className}>
      {text}
    </time>
  );
}
