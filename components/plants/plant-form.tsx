"use client";

import { useActionState } from "react";
import type { PlantFormState } from "@/app/plants/actions";
import type { Plant } from "@/lib/types/domain";

const INPUT =
  "mt-1.5 block w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted/70 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20 aria-[invalid=true]:border-clay";

type Props = {
  action: (state: PlantFormState, formData: FormData) => Promise<PlantFormState>;
  plant?: Plant;
  submitLabel: string;
};

export function PlantForm({ action, plant, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const errors = state.fieldErrors ?? {};
  const prefs = (plant?.carePreferences ?? {}) as Record<string, string | undefined>;

  return (
    <form action={formAction} className="space-y-8" noValidate>
      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-3 font-serif text-lg text-ink">Profile</legend>
        <Field label="Name" name="name" required error={errors.name} defaultValue={plant?.name} placeholder="e.g. Living room monstera" />
        <Field label="Species" name="species" error={errors.species} defaultValue={plant?.species} placeholder="e.g. Monstera deliciosa" hint="Leave blank if unknown." />
        <Field label="Location or room" name="location" error={errors.location} defaultValue={plant?.location} placeholder="e.g. Living room, east window" />
        <Field label="Planting date" name="plantedAt" type="date" error={errors.plantedAt} defaultValue={plant?.plantedAt} hint="Optional." />
        <Field label="Light conditions" name="lightConditions" error={errors.lightConditions} defaultValue={plant?.lightConditions} placeholder="e.g. Bright indirect, 2 h morning sun" />
        <Field label="Pot and soil" name="potNotes" error={errors.potNotes} defaultValue={plant?.potNotes} placeholder="e.g. 20 cm terracotta, chunky aroid mix" />
        <Field label="Notes" name="notes" error={errors.notes} defaultValue={plant?.notes} multiline className="sm:col-span-2" />
      </fieldset>

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-1 font-serif text-lg text-ink">Your care preferences</legend>
        <p className="-mt-2 text-sm text-ink-muted sm:col-span-2">
          What you already know works for this plant. Planti treats these as your guidance, not as verified species facts.
        </p>
        <Field label="Watering" name="careWatering" error={errors["carePreferences.watering"]} defaultValue={prefs.watering} placeholder="e.g. When the top 3 cm are dry" />
        <Field label="Light" name="careLight" error={errors["carePreferences.light"]} defaultValue={prefs.light} placeholder="e.g. Keep out of afternoon sun" />
        <Field label="Other" name="careOther" error={errors["carePreferences.other"]} defaultValue={prefs.other} multiline className="sm:col-span-2" />
      </fieldset>

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6" aria-live="polite">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-forest px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-forest-hover disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        {state.error ? <p className="text-sm text-clay">{state.error}</p> : null}
        {state.saved && !pending ? <p className="text-sm text-forest">Saved.</p> : null}
      </div>
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  error?: string;
  defaultValue?: string | null;
  placeholder?: string;
  hint?: string;
  type?: string;
  required?: boolean;
  multiline?: boolean;
  className?: string;
};

function Field({ label, name, error, defaultValue, placeholder, hint, type = "text", required, multiline, className = "" }: FieldProps) {
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;
  const common = {
    id: name,
    name,
    defaultValue: defaultValue ?? "",
    placeholder,
    required,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    className: INPUT,
  };
  return (
    <div className={className}>
      <label htmlFor={name} className="text-sm font-medium text-ink">
        {label}
        {required ? <span className="text-clay"> *</span> : null}
      </label>
      {multiline ? <textarea rows={3} {...common} /> : <input type={type} {...common} />}
      {error ? (
        <p id={`${name}-error`} className="mt-1 text-xs text-clay">{error}</p>
      ) : hint ? (
        <p id={`${name}-hint`} className="mt-1 text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}
