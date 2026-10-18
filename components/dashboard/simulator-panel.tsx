"use client";

import { startTransition, useActionState, useState } from "react";
import { clearSimulationAction, runScenarioAction, type SimulationState } from "@/app/actions/simulation";
import { Panel } from "@/components/ui/panel";
import { SCENARIOS, type ScenarioId } from "@/lib/simulation/scenarios";

const DEFAULT_SEED = 20261018;

export function SimulatorPanel({ plantId }: { plantId: string }) {
  const [runState, runAction, running] = useActionState<SimulationState, FormData>(runScenarioAction, {});
  const [clearState, clearAction, clearing] = useActionState<SimulationState, FormData>(clearSimulationAction, {});
  const [scenario, setScenario] = useState<ScenarioId>("watering_response");
  const [last, setLast] = useState<"run" | "clear">("run");
  const state = last === "clear" ? clearState : runState;

  return (
    <Panel eyebrow="Simulator · writes simulated data" title="Demo timelines">
      <form
        // Submitted manually: React's automatic post-action form reset would
        // snap the controlled scenario select and the seed back to defaults.
        onSubmit={(e) => {
          e.preventDefault();
          setLast("run");
          const formData = new FormData(e.currentTarget);
          startTransition(() => runAction(formData));
        }}
        className="space-y-3"
      >
        <input type="hidden" name="plantId" value={plantId} />
        <div>
          <label htmlFor="scenario" className="text-sm font-medium text-ink">Scenario</label>
          <select
            id="scenario"
            name="scenario"
            value={scenario}
            onChange={(e) => setScenario(e.target.value as ScenarioId)}
            className="mt-1.5 block w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
          >
            {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => (
              <option key={id} value={id}>{SCENARIOS[id].label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-muted">{SCENARIOS[scenario].description}</p>
        </div>
        <div>
          <label htmlFor="seed" className="text-sm font-medium text-ink">Seed</label>
          <input
            id="seed"
            name="seed"
            type="number"
            min={1}
            defaultValue={DEFAULT_SEED}
            className="mt-1.5 block w-full rounded-lg border border-line-strong bg-surface px-3 py-2 font-mono text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20"
          />
          <p className="mt-1 text-xs text-ink-muted">The same seed always produces the same timeline.</p>
        </div>
        <button
          type="submit"
          disabled={running || clearing}
          className="w-full rounded-lg bg-forest px-4 py-2 text-sm font-medium text-paper hover:bg-forest-hover disabled:opacity-60"
        >
          {running ? "Loading…" : "Load scenario"}
        </button>
      </form>

      <form action={clearAction} onSubmit={() => setLast("clear")} className="mt-2">
        <input type="hidden" name="plantId" value={plantId} />
        <button
          type="submit"
          disabled={running || clearing}
          className="w-full rounded-lg border border-line-strong px-4 py-2 text-sm text-ink hover:bg-sunken disabled:opacity-60"
        >
          {clearing ? "Clearing…" : "Clear simulated data"}
        </button>
      </form>

      <div aria-live="polite" className="mt-3 text-sm">
        {state.error ? <p className="text-clay">{state.error}</p> : null}
        {state.message ? <p className="text-forest">{state.message}</p> : null}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-muted">
        Loading a scenario replaces this plant&apos;s simulated readings and simulated care events. Measured readings from a
        device are never changed. Everything it writes is labeled simulated.
      </p>
    </Panel>
  );
}
