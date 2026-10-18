"use client";

import { useActionState } from "react";
import { testModelsAction, type ModelTestState } from "@/app/settings/actions";

export function ModelTest() {
  const [state, action, pending] = useActionState<ModelTestState>(testModelsAction, {});
  return (
    <form action={action} className="space-y-3">
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm text-ink hover:bg-sunken disabled:opacity-60"
      >
        {pending ? "Testing…" : "Test model connection"}
      </button>
      <div aria-live="polite" className="space-y-1 text-sm">
        {state.error ? <p className="text-clay">{state.error}</p> : null}
        {state.results?.map((r) => (
          <p key={r.model} className={r.ok ? "text-forest" : "text-clay"}>
            <code className="font-mono">{r.model}</code>: {r.ok ? "OK" : "Failed"}, {r.detail}
          </p>
        ))}
      </div>
    </form>
  );
}
