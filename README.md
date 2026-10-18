# Planti

**Less guessing. More growing.**

An intelligent plant-care agent that learns from your plant's history, combines
real-time sensor data with trusted horticultural research, and helps you
understand what your plants need. Planti tracks changing conditions, recommends
evidence-based care, and learns from the results over time.

Built for the Nebius x NVIDIA Global AI Hackathon.

> **Status: Phase 5 (care + verification).** The full observe → analyze →
> recommend → act → verify loop works end to end on Supabase, with real NVIDIA
> Nemotron assessments through Nebius Token Factory. That covers care logging,
> persisted intervention outcomes and a simulator fast-forward for live demos.
> Tavily research and the T-Display S3 firmware come in later phases. Nothing
> below claims more than that.

## How Planti keeps its claims honest

Every value on screen is one of four kinds, and the UI labels which:

| Kind | Produced by |
| --- | --- |
| Measured | The T-Display S3 and soil sensor (`source = device`) |
| Simulated | The seeded simulator (`source = simulated`), always labeled |
| Calculated | Deterministic TypeScript in `lib/analysis/` |
| Interpreted | NVIDIA Nemotron via Nebius Token Factory, from the calculated evidence |

The model interprets evidence. Application code does the calculations and
decides what actions are allowed. External research through Tavily is selective:
it runs only when a deterministic policy finds a real unanswered question, and the
evidence is saved and reused rather than searched again on every reading.

## Brand

The logo kit is in `public/planti-logo/` (see its README). The app uses the forest logo in the
header, the leaf mark on small screens, the kit's favicon, Apple touch icon and 1200×630 link
preview (Next.js file conventions in `app/`), the brand palette (Forest `#1F4D3A`, Neon
`#B6F23A`, Deep, Ivory, Moss, Sage) as Tailwind tokens, Outfit for headings and IBM Plex Mono for
data. Neon is used only as an accent; it is too light for text on Ivory.

## Requirements

- Node.js 20.9 or newer (`.nvmrc` pins 22.19.0)
- npm

## Run locally

```bash
nvm use
npm install
# create .env.local with the variables below
npm run dev                  # http://localhost:3000
```

### Environment variables (`.env.local`)

Only `NEXT_PUBLIC_*` values reach the browser. Everything else is server-only.

| Variable | Where to get it | Used for |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | All database access |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same page (`sb_publishable_…`) | Browser and user-scoped queries; RLS applies |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page (secret key) | Server-only writes after credential/ownership checks |
| `SUPABASE_DB_URL` | Supabase → Connect → Session pooler | Applying migrations with the CLI only |
| `NEBIUS_API_KEY` | Nebius Token Factory → API keys | Nemotron assessments |
| `NEBIUS_BASE_URL` | `https://api.tokenfactory.nebius.com/v1/` | Nemotron assessments |
| `NEBIUS_MODEL` | Primary model, e.g. `nvidia/Nemotron-3_5-Lightning` | Nemotron assessments |
| `NEBIUS_MODEL_SUPER` | Optional comparison model, e.g. `nvidia/nemotron-3-super-120b-a12b` (IDs are case-sensitive) | `npm run compare:models` |
| `NEBIUS_ENABLE_THINKING` | Optional; reasoning is on unless `false` | Nemotron assessments |
| `TAVILY_API_KEY` | app.tavily.com → API keys | Selective research |
| `TAVILY_BASE_URL` | `https://api.tavily.com` (optional) | Selective research |
| `DEVICE_INGESTION_SECRET` | `openssl rand -hex 32` | Hashing device credentials |
| `DEVICE_ONLINE_THRESHOLD_MINUTES` | Optional, default `15` | When a device counts as online |
| `PLANTI_SIMULATOR_ENABLED` | Optional; on in dev, off in production unless `true` | Demo simulator |
| `NEXT_PUBLIC_APP_URL` | e.g. `http://localhost:3000` | Auth email redirects |

The app runs without any credentials. Missing integrations show a setup notice,
and **Settings** lists which ones are configured (variable names only).

## Supabase setup

1. Create a Supabase project and fill in the Supabase values in `.env.local`.
2. Apply the migrations in `supabase/migrations/` (in filename order). Either:
   - set `SUPABASE_DB_URL` (Connect → Session pooler; URL-encode special
     characters in the password) and run
     `npx supabase db push --db-url "$SUPABASE_DB_URL"`, or
   - paste each file into the Supabase SQL Editor in order.
3. Optional for quick testing: Authentication → Providers → Email → turn off
   **Confirm email**. With it on, the confirmation link lands on `/auth/confirm`.
4. Sign up in the app, then optionally seed a simulated demo plant:
   `npm run seed:demo -- --email you@example.com` (add `--reset` to replace it).
5. Verify RLS against your project: `npm run verify:rls`. This creates two
   temporary users, checks the policies through the public API, and deletes them.

## Analysis engine

All calculations are plain TypeScript in `lib/analysis/`, pure and unit tested.
The model never computes them.

- **Cleaning:** malformed, missing, out-of-range and duplicate readings are dropped and counted.
- **Trend:** least-squares fit over readings *since the last watering or sustained jump* (so a
  watering never bends the slope). Reports `declining`, `rising`, `stable`, `unclear`, or
  `insufficient_data` (fewer than 8 readings or under 6 hours). It never guesses.
- **Drying rate:** reported only for a clear decline.
- **Sudden changes:** median-based and noise-adaptive, so sensor spikes aren't mistaken for watering.
- **Before/after comparison:** readings nearest a care event versus readings after a soak-in
  period. Outcomes are `moisture_increase_observed`, `no_measurable_change`,
  `pending_observation` or `inconclusive`, and are worded as observations, never causes.
- **Confidence:** from sample count, span, fit and freshness; stale, insufficient or unclear
  data is always low.

Thresholds live in `lib/analysis/config.ts` and are data-quality heuristics, not plant
requirements.

## Nemotron assessments

`POST /api/assessments` (also behind **Run assessment** on the dashboard):

1. Verifies the signed-in user owns the plant.
2. Loads up to 7 days of readings, care events and the last 3 assessments.
3. Runs the deterministic analysis.
4. Builds bounded evidence (`lib/ai/evidence.ts`): calculated values, hourly medians for the last
   48 hours instead of raw readings, clipped free text, and sources labeled.
5. Calls the model through Nebius Token Factory's OpenAI-compatible Chat Completions API with the
   fixed Planti system prompt (`lib/ai/prompts.ts`). It requests **strict JSON-schema output**
   generated from the same Zod schema used for validation.
6. Validates the reply with Zod and caps the model's confidence at the calculated confidence.
7. Saves the assessment with its evidence and call metadata, using the service role. Browsers
   cannot insert assessments.

If nothing has changed since the last assessment (same evidence fingerprint, under 6 hours old),
the stored one is reused instead of calling the model. If a reasoning attempt runs out of tokens
or time, Planti retries once without reasoning and records that it did. If the model is unavailable
or its output is invalid, the user gets a **deterministic fallback**. It is clearly labeled, built
only from the calculations, and never saved as an AI assessment. Requests are rate-limited per
user. Settings shows the configured models, the last call's status, and a connection test.

### Model choice

`npm run compare:models` runs real inference on the five simulator scenarios with the primary
model (reasoning on and off) and the comparison model. Results and reviewer notes are in
[`docs/evaluation/`](docs/evaluation/). Asking only for "a JSON object", Lightning was
schema-valid in 0–2 of 5 runs. With strict JSON-schema output, all 15 runs were valid.
Lightning with reasoning on was the most faithful to the evidence (~16–30 s), so it is the
default. Reasoning off was faster but made unsupported claims.

## Care and verification

**Log watering** opens a dialog for watering, fertilizing, moving, repotting or other care
(`POST /api/care-events`; time, amount and notes are validated, and care can't be logged in the future).

Each watering immediately gets an `intervention_outcomes` record marked `pending_observation`,
linked to the assessment that preceded it (within 48 hours). As readings arrive, a lightweight
server-side refresh compares readings just before the watering with readings after a soak-in
period, using the same deterministic code as the analysis. It runs on dashboard loads, after
care is logged, after assessments and after simulator runs, with no scheduler and no
blocking. The outcome becomes `moisture_increase_observed`, `no_measurable_change` or
`inconclusive`, worded as an observed response, never a proven cause. Final outcomes are never
recomputed, so the record of what was seen stays stable. Outcomes are written by the server;
users can read them but not create or edit them.

### Fast-forward (demo)

Real soil takes hours to show a response, so the simulator panel has **Fast-forward**. For a
plant with only simulated data, it moves the simulated readings, care events and assessments
back by 3, 6 or 12 hours. It then adds that many hours of simulated readings that respond to your
most recently logged watering, or to a simulated watering if you haven't logged one.
Shifted records note how far they were moved. Plants with any measured device readings are
refused, so real history is never rewritten.

Demo loop: load *Moisture gradually declining* → **Run assessment** → **Log watering** →
**Fast-forward 6 hours** → the outcome becomes *Moisture rose afterwards* and Plant Memory
updates → **Run assessment** again and the model sees the response.

## Plant Memory

`lib/memory/narrative.ts` writes the summary sentence by sentence from the analysis. Each
sentence only appears when the evidence supports it. `lib/memory/timeline.ts` links care
events to the responses that followed, unexplained jumps, reporting gaps and assessments.
Every entry says whether it was logged, calculated from readings, or interpreted by the model.

## Simulator

Five seeded scenarios (`lib/simulation/scenarios.ts`): gradual decline, watering response,
stable, noisy sensor, and stale/disconnected device. The same seed always gives the same
timeline. Run them from the dashboard's **Demo timelines** panel. The simulator writes
through the user's own session, so RLS limits it to that user's plants and to
`source = 'simulated'`, and it can only clear simulated data. Each scenario runs through the
same analysis code as live data, and tests check the result.

## Security model

- **RLS on every table**, with access derived from plant ownership. Anonymous
  requests get no access to private data.
- **Browsers can add only simulated or manual readings.** Device readings arrive
  only through verified telemetry; the database rejects `source = 'device'` from
  user sessions.
- **Assessments, outcomes and research records are server-written.** Users can
  read their own but cannot insert them, so a browser cannot forge an AI result.
- **Device credentials** are 256-bit random values shown once at pairing. The
  database stores only `HMAC-SHA256(DEVICE_INGESTION_SECRET, credential)`, and the
  hash column is not readable by users.
- **Service-role key** is used only server-side, after a credential or ownership
  check (`lib/supabase/admin.ts`).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generates Next.js route types, then `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run check` | Lint, typecheck and tests |
| `npm run seed:demo -- --email <you>` | Seed a simulated demo plant (needs service-role key) |
| `npm run verify:rls` | Live RLS integration check against your Supabase project |
| `npm run compare:models` | Real Nebius inference comparison (needs Nebius env vars) |

`npm test` includes RLS tests that apply the real migrations to an in-process
Postgres (PGlite), so they need no credentials.

## Project layout

```
app/                 Routes (dashboard, plants, settings, login)
components/          UI, grouped by feature (dashboard, charts, devices, memory, plants, shell, ui)
lib/ai/              Nebius client, prompts, evidence builder, schemas, fallback
lib/analysis/        Deterministic calculations (pure, unit tested)
lib/devices/         Device credential generation and verification
lib/services/        Server-side data access (always via the user-scoped client first)
lib/memory/          Plant Memory narrative and timeline
lib/simulation/      Seeded, repeatable simulated timelines
lib/validation/      Zod schemas for user input
supabase/migrations/ Versioned schema, constraints and RLS policies
scripts/             Demo seeding, live RLS verification, model comparison
docs/evaluation/     Model comparison results and notes
lib/supabase/        Browser, server and proxy Supabase clients
lib/env.ts           Server-side configuration and integration status
proxy.ts             Refreshes the Supabase session (Next.js 16 replaces middleware with proxy)
tests/               Vitest suites
```

## License

MIT. See [LICENSE](LICENSE).
