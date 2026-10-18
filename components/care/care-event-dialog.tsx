"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { CareEventType } from "@/lib/types/domain";

const TYPES: { value: CareEventType; label: string }[] = [
  { value: "watered", label: "Watered" },
  { value: "fertilized", label: "Fertilized" },
  { value: "moved", label: "Moved plant" },
  { value: "repotted", label: "Changed soil or pot" },
  { value: "other", label: "Other care" },
];

const INPUT =
  "mt-1.5 block w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20";

/** Value for a datetime-local input, in the viewer's own time zone. */
function localNow() {
  const d = new Date();
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function CareEventDialog({ plantId }: { plantId: string }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [type, setType] = useState<CareEventType>("watered");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  const [defaultWhen, setDefaultWhen] = useState("");

  function open() {
    setError(null);
    setType("watered");
    setDefaultWhen(localNow());
    dialogRef.current?.showModal();
  }

  async function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    const when = String(data.get("occurredAt") ?? "");
    const amount = String(data.get("amountMl") ?? "").trim();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/care-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plantId,
          eventType: type,
          // Left at its default, the server stamps the exact moment (the input
          // drops seconds). Otherwise datetime-local is read as local time.
          occurredAt: when && when !== defaultWhen ? new Date(when).toISOString() : undefined,
          amountMl: amount ? Number(amount) : null,
          notes: String(data.get("notes") ?? "").trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.message ?? (res.status === 404 ? "Plant not found." : "Could not save. Try again."));
        return;
      }
      dialogRef.current?.close();
      setNotice(
        type === "watered"
          ? "Watering logged. Planti will compare readings before and after it as new readings arrive."
          : "Care logged.",
      );
      startTransition(() => router.refresh());
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button type="button" onClick={open} className="rounded-lg bg-forest px-4 py-2 text-sm font-medium text-paper hover:bg-forest-hover">
        Log watering
      </button>
      {notice ? (
        <p role="status" className="max-w-xs text-sm text-forest sm:text-right">
          {notice}
        </p>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-labelledby="care-dialog-title"
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-card border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/30"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(e.currentTarget);
          }}
          className="space-y-5 p-6"
        >
          <div>
            <h2 id="care-dialog-title" className="font-display font-semibold text-xl text-ink">Log care</h2>
            <p className="mt-1 text-sm text-ink-muted">Planti compares readings before and after each watering to see how the plant responds.</p>
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-ink">What did you do?</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <label
                  key={t.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    type === t.value ? "border-forest bg-moss-soft text-forest" : "border-line-strong text-ink hover:bg-sunken"
                  }`}
                >
                  <input
                    type="radio"
                    name="eventType"
                    value={t.value}
                    checked={type === t.value}
                    onChange={() => setType(t.value)}
                    className="accent-[var(--color-forest)]"
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="occurredAt" className="text-sm font-medium text-ink">When</label>
              <input id="occurredAt" name="occurredAt" type="datetime-local" key={defaultWhen} defaultValue={defaultWhen} max={defaultWhen} className={INPUT} />
            </div>
            {type === "watered" || type === "fertilized" ? (
              <div>
                <label htmlFor="amountMl" className="text-sm font-medium text-ink">Amount (ml)</label>
                <input id="amountMl" name="amountMl" type="number" min={1} max={20000} inputMode="numeric" placeholder="Optional" className={INPUT} />
              </div>
            ) : null}
          </div>

          <div>
            <label htmlFor="notes" className="text-sm font-medium text-ink">Notes</label>
            <textarea id="notes" name="notes" rows={2} maxLength={1000} placeholder="Optional" className={INPUT} />
          </div>

          {error ? <p role="alert" className="text-sm text-clay">{error}</p> : null}

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={() => dialogRef.current?.close()} className="rounded-lg border border-line-strong px-4 py-2 text-sm text-ink hover:bg-sunken">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="rounded-lg bg-forest px-4 py-2 text-sm font-medium text-paper hover:bg-forest-hover disabled:opacity-60">
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
