import type { Metadata } from "next";
import { connection } from "next/server";
import { Panel } from "@/components/ui/panel";
import { deviceOnlineThresholdMinutes, integrationStatuses, simulatorEnabled, type Integration } from "@/lib/env";

export const metadata: Metadata = { title: "Settings" };

const DESCRIPTIONS: Record<Integration, { name: string; purpose: string }> = {
  supabase: { name: "Supabase", purpose: "Stores plants, readings, care events and assessments. Required." },
  supabaseAdmin: { name: "Supabase server key", purpose: "Lets verified devices write readings. Server only." },
  nebius: { name: "Nebius Token Factory", purpose: "Runs the NVIDIA Nemotron model that interprets the evidence." },
  tavily: { name: "Tavily", purpose: "Selective horticultural research when a real question comes up." },
  deviceIngestion: { name: "Device ingestion", purpose: "Verifies per-device credentials on telemetry uploads." },
};

export default async function SettingsPage() {
  // Report the running configuration, not the one present at build time.
  await connection();
  const statuses = integrationStatuses();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-ink">Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">Integration status. Only variable names are shown, never their values.</p>
      </div>

      <Panel eyebrow="Diagnostics" title="Integrations">
        <ul className="divide-y divide-line">
          {statuses.map(({ integration, configured, missing }) => (
            <li key={integration} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div>
                <p className="text-sm font-medium text-ink">{DESCRIPTIONS[integration].name}</p>
                <p className="text-sm text-ink-muted">{DESCRIPTIONS[integration].purpose}</p>
                {missing.length ? (
                  <p className="mt-1 text-xs text-ink-muted">
                    Missing: {missing.map((m) => <code key={m} className="mr-1.5 font-mono text-ink">{m}</code>)}
                  </p>
                ) : null}
              </div>
              <span
                className={`w-fit shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  configured ? "bg-moss-soft text-forest" : "bg-sunken text-ink-muted"
                }`}
              >
                {configured ? "Configured" : "Not configured"}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel eyebrow="Demo" title="Simulator">
        <p className="text-sm text-ink">
          The simulator is <span className="font-medium">{simulatorEnabled() ? "on" : "off"}</span> on this server.
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          It is on in development and off in production unless <code className="font-mono">PLANTI_SIMULATOR_ENABLED=true</code>.
          Everything it writes is stored and shown as simulated, and it can only replace simulated data.
        </p>
      </Panel>

      <Panel eyebrow="Heuristics" title="Thresholds">
        <p className="text-sm text-ink">
          A device counts as online if it sent a reading in the last{" "}
          <span className="font-mono">{deviceOnlineThresholdMinutes()}</span> minutes.
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Set <code className="font-mono">DEVICE_ONLINE_THRESHOLD_MINUTES</code> to change it. This is a heuristic, not a property
          of the plant.
        </p>
      </Panel>
    </div>
  );
}
