"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthFormState } from "./actions";

const INPUT =
  "mt-1.5 block w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted/70 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20";

export function AuthForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [signInState, signInAction, signingIn] = useActionState<AuthFormState, FormData>(signIn, {});
  const [signUpState, signUpAction, signingUp] = useActionState<AuthFormState, FormData>(signUp, {});
  const state = mode === "sign-in" ? signInState : signUpState;
  const pending = signingIn || signingUp;

  return (
    <div className="rounded-card border border-line bg-surface p-6 sm:p-8">
      <div role="tablist" aria-label="Account" className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-sunken p-1 text-sm">
        {(["sign-in", "sign-up"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1.5 transition-colors ${mode === m ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}
          >
            {m === "sign-in" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form action={mode === "sign-in" ? signInAction : signUpAction} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="text-sm font-medium text-ink">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.email} className={INPUT} />
        </div>
        <div>
          <label htmlFor="password" className="text-sm font-medium text-ink">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            required
            minLength={8}
            className={INPUT}
          />
          {mode === "sign-up" ? <p className="mt-1 text-xs text-ink-muted">At least 8 characters.</p> : null}
        </div>

        <div aria-live="polite">
          {state.error ? <p className="rounded-lg bg-clay-soft px-3 py-2 text-sm text-clay">{state.error}</p> : null}
          {state.message ? <p className="rounded-lg bg-moss-soft px-3 py-2 text-sm text-forest">{state.message}</p> : null}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-forest px-4 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-forest-hover disabled:opacity-60"
        >
          {pending ? "Working…" : mode === "sign-in" ? "Sign in" : "Create account"}
        </button>
      </form>
    </div>
  );
}
