import { Activity, BookOpen, Calculator, Cpu, Droplets, Eye, ListChecks, Sparkles, Thermometer, Wifi } from "lucide-react";
import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";

const LOOP = [
  { icon: Eye, title: "Observe", body: "A soil sensor reports moisture and temperature every minute, and each reading lands in your plant's history." },
  { icon: Calculator, title: "Analyze", body: "Planti calculates trends, drying rate and time since watering with plain, testable code. No guessing at the numbers." },
  { icon: Sparkles, title: "Recommend", body: "NVIDIA Nemotron reads that evidence and explains what your plant needs, with a confidence level you can see." },
  { icon: ListChecks, title: "Act", body: "Log what you did: watering, feeding, moving it to more light. Care events sit right on the moisture chart." },
  { icon: Activity, title: "Verify", body: "Planti checks whether the care worked by comparing the readings before and after, then remembers the outcome." },
] as const;

const KINDS = [
  { label: "Measured", body: "Straight from the sensor in your pot." },
  { label: "Simulated", body: "Demo data, always marked as simulated." },
  { label: "Calculated", body: "Deterministic math on your readings." },
  { label: "Interpreted", body: "The model's reading of that evidence." },
] as const;

/** Public home page for signed-out visitors. Signed-in users get the dashboard at the same URL. */
export function LandingPage() {
  return (
    <div className="space-y-16 sm:space-y-24">
      {/* Hero */}
      <section className="overflow-hidden rounded-card bg-deep text-paper">
        <div className="grid gap-10 px-6 py-12 sm:px-10 sm:py-16 lg:grid-cols-12 lg:items-center lg:gap-12">
          <div className="lg:col-span-7">
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-neon">Plant care with a memory</p>
            <h1 className="mt-3 font-display text-4xl font-semibold leading-[1.05] sm:text-6xl">
              Less guessing.
              <br />
              <span className="text-neon">More growing.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-sage sm:text-lg">
              Planti is a plant-care agent that learns from your plant&apos;s history. It combines live sensor readings with
              trusted horticultural research, tells you what your plant needs, and checks whether the care actually worked.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/login?mode=sign-up" className="bg-neon px-5 py-2.5 text-deep hover:bg-neon/90">
                Create a free account
              </ButtonLink>
              <ButtonLink
                href="/login"
                variant="secondary"
                className="border-sage/40 bg-transparent px-5 py-2.5 text-paper hover:bg-paper/10"
              >
                Sign in
              </ButtonLink>
            </div>
          </div>

          {/* Mock of the device screen */}
          <div className="lg:col-span-5">
            <div className="mx-auto max-w-md rounded-2xl border border-sage/20 bg-[#0c1a13] p-5 shadow-2xl shadow-black/30">
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-semibold text-neon">planti</span>
                <span className="flex items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-sage">
                  <Wifi className="h-3.5 w-3.5" aria-hidden="true" /> live
                </span>
              </div>
              <p className="mt-5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-sage">Soil moisture</p>
              <p className="font-display text-6xl font-semibold leading-none text-paper">
                42<span className="text-3xl text-sage">%</span>
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper/10" aria-hidden="true">
                <div className="h-full w-[42%] rounded-full bg-neon" />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 font-mono text-xs text-sage">
                <div className="flex items-center gap-2 rounded-lg bg-paper/5 px-3 py-2">
                  <Thermometer className="h-4 w-4 text-neon" aria-hidden="true" /> 23.4°C
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-paper/5 px-3 py-2">
                  <Droplets className="h-4 w-4 text-neon" aria-hidden="true" /> drying slowly
                </div>
              </div>
              <p className="mt-4 font-mono text-[0.6875rem] text-sage/80">Sent 12s ago · next reading in 48s</p>
            </div>
          </div>
        </div>
      </section>

      {/* The loop */}
      <section aria-labelledby="loop-heading">
        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-forest">How it works</p>
        <h2 id="loop-heading" className="mt-1 max-w-2xl font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl">
          A care loop that closes itself
        </h2>
        <p className="mt-3 max-w-2xl text-ink-muted">
          Most plant apps stop at a reminder. Planti follows through: it watches what happens after you act and keeps that
          in your plant&apos;s memory for next time.
        </p>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {LOOP.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="rounded-card border border-line bg-surface p-5">
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-moss-soft text-forest">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="font-mono text-xs text-ink-muted">0{i + 1}</span>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-ink">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Plant memory + honesty */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-card border border-line bg-surface p-6 sm:p-8">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-moss-soft text-forest">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-display text-2xl font-semibold text-ink">Plant Memory</h2>
          <p className="mt-2 leading-relaxed text-ink-muted">
            Every reading, recommendation and care event becomes part of a timeline written in plain language. Planti learns
            how fast your pot dries out, how your plant responds to watering, and what worked last time, so advice gets more
            specific the longer you use it.
          </p>
        </div>
        <div className="rounded-card border border-line bg-surface p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold text-ink">Honest about every number</h2>
          <p className="mt-2 leading-relaxed text-ink-muted">
            Every value on screen is labeled by where it came from, so you always know what is a fact and what is a judgment.
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-3">
            {KINDS.map(({ label, body }) => (
              <div key={label} className="rounded-lg bg-sunken px-4 py-3">
                <dt className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-forest">{label}</dt>
                <dd className="mt-1 text-sm text-ink-muted">{body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Hardware */}
      <section className="grid gap-8 rounded-card border border-line bg-sunken p-6 sm:p-10 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-7">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-forest">The hardware</p>
          <h2 className="mt-1 font-display text-3xl font-semibold leading-tight text-ink">A sensor in the pot, a screen on the shelf</h2>
          <p className="mt-3 leading-relaxed text-ink-muted">
            Planti runs on a LILYGO T-Display S3 with a capacitive soil sensor. It shows moisture and temperature on its own
            screen and uploads a reading every minute over Wi-Fi. Pair it to a plant in a few clicks. No sensor yet? The
            dashboard works with simulated data so you can try the full loop first.
          </p>
        </div>
        <ul className="space-y-3 lg:col-span-5">
          {[
            { icon: Cpu, text: "ESP32-S3 board with a built-in display" },
            { icon: Droplets, text: "Capacitive soil moisture and temperature sensor" },
            { icon: Wifi, text: "Per-device credential, readings sent over HTTPS" },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink">
              <Icon className="h-5 w-5 shrink-0 text-forest" aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>
      </section>

      {/* Closing CTA */}
      <section className="flex flex-col items-center rounded-card bg-forest px-6 py-12 text-center text-paper sm:py-16">
        <Image src="/planti-logo/mark-colors/planti-mark-neon.svg" alt="" width={56} height={56} unoptimized className="h-14 w-14" />
        <h2 className="mt-5 max-w-xl font-display text-3xl font-semibold leading-tight sm:text-4xl">
          Give your plant a memory.
        </h2>
        <p className="mt-3 max-w-lg text-sage">Your plants, readings and care history stay private to your account.</p>
        <ButtonLink href="/login?mode=sign-up" className="mt-7 bg-neon px-6 py-2.5 text-deep hover:bg-neon/90">
          Get started
        </ButtonLink>
      </section>

      <footer className="flex flex-col items-center justify-between gap-3 border-t border-line pt-6 text-sm text-ink-muted sm:flex-row">
        <span>Planti · Built for the Nebius × NVIDIA Global AI Hackathon</span>
        <span className="font-mono text-xs">Less guessing. More growing.</span>
      </footer>
    </div>
  );
}
