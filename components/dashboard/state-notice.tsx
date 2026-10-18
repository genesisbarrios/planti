import { ButtonLink } from "@/components/ui/button";
import type { DashboardState } from "@/lib/services/dashboard";

/** Explains why the dashboard is empty and what to do next. */
export function StateNotice({ state }: { state: DashboardState }) {
  if (state.kind === "ready") return null;

  const content = {
    unconfigured: {
      title: "Connect Supabase to start",
      body: (
        <>
          Planti stores plants, readings and care history in Supabase. Add these to <code className="font-mono">.env.local</code>{" "}
          and restart the dev server:{" "}
          {state.kind === "unconfigured"
            ? state.missing.map((name, i) => (
                <span key={name}>
                  {i ? ", " : ""}
                  <code className="font-mono text-ink">{name}</code>
                </span>
              ))
            : null}
          .
        </>
      ),
      action: <ButtonLink href="/settings" variant="secondary">View setup status</ButtonLink>,
    },
    signed_out: {
      title: "Sign in to see your plants",
      body: <>Your plants and their history are private to your account.</>,
      action: <ButtonLink href="/login">Sign in</ButtonLink>,
    },
    schema_pending: {
      title: "Database schema not applied yet",
      body: <>Supabase is connected, but the Planti tables don&apos;t exist yet. Apply the migrations in supabase/migrations.</>,
      action: <ButtonLink href="/settings" variant="secondary">View setup status</ButtonLink>,
    },
    no_plants: {
      title: "Add your first plant",
      body: <>Create a plant profile, then pair the sensor or run the simulator to start its memory.</>,
      action: <ButtonLink href="/plants/new">Add plant</ButtonLink>,
    },
  }[state.kind];

  return (
    <div role="status" className="flex flex-col gap-3 rounded-card border border-line bg-sunken px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-ink">{content.title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{content.body}</p>
      </div>
      {content.action ? <div className="shrink-0">{content.action}</div> : null}
    </div>
  );
}
