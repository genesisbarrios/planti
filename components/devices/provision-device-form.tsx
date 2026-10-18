"use client";

import { useActionState, useState } from "react";
import type { ProvisionState } from "@/app/plants/actions";

export function ProvisionDeviceForm({ action }: { action: (state: ProvisionState, formData: FormData) => Promise<ProvisionState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [copied, setCopied] = useState(false);

  if (state.credential && state.deviceId) {
    return (
      <div role="status" className="space-y-3 rounded-lg border border-amber/30 bg-amber-soft px-4 py-4">
        <p className="text-sm font-medium text-ink">Device created. Copy this credential now: it won&apos;t be shown again.</p>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-[0.12em] text-ink-muted">Device ID</dt>
            <dd className="break-all font-mono text-ink">{state.deviceId}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.12em] text-ink-muted">Device credential</dt>
            <dd className="break-all font-mono text-ink">{state.credential}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(`PLANTI_DEVICE_ID=${state.deviceId}\nPLANTI_DEVICE_CREDENTIAL=${state.credential}`);
            setCopied(true);
          }}
          className="rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink hover:bg-sunken"
        >
          {copied ? "Copied" : "Copy both"}
        </button>
        <p className="text-xs leading-relaxed text-ink-muted">
          Put these in the firmware&apos;s local secrets file, which is git-ignored. Planti stores only a keyed hash of the
          credential, so a lost credential can&apos;t be recovered: remove the device and create a new one.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label htmlFor="deviceName" className="text-sm font-medium text-ink">Device name</label>
        <input
          id="deviceName"
          name="deviceName"
          maxLength={120}
          placeholder="e.g. T-Display S3 on the windowsill"
          className="mt-1.5 block w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-forest px-4 py-2 text-sm font-medium text-paper hover:bg-forest-hover disabled:opacity-60"
      >
        {pending ? "Creating…" : "Pair a device"}
      </button>
      {state.error ? <p className="text-sm text-clay sm:basis-full" role="alert">{state.error}</p> : null}
    </form>
  );
}
