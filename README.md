# Planti

Planti is a plant-care agent that keeps a memory of one plant's readings and care.
It estimates when the plant may need attention, recommends a next step based on
evidence, and then checks the readings that follow to see what actually happened.

Built for the Nebius x NVIDIA Global AI Hackathon.

> **Status: Phase 2 (Supabase).** Schema, Row Level Security, auth, plant
> profiles, device pairing and live dashboard queries work against a real
> Supabase project. The analysis engine, Nemotron assessments, care-event
> verification, Tavily research and firmware arrive in later phases. Nothing
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

## Requirements

- Node.js 20.9 or newer (`.nvmrc` pins 22.19.0)
- npm

## Run locally

```bash
nvm use
npm install
cp .env.example .env.local   # fill in what you have; see comments in the file
npm run dev                  # http://localhost:3000
```

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

`npm test` includes RLS tests that apply the real migrations to an in-process
Postgres (PGlite), so they need no credentials.

## Project layout

```
app/                 Routes (dashboard, plants, settings, login)
components/          UI, grouped by feature (dashboard, charts, devices, memory, plants, shell, ui)
lib/analysis/        Deterministic calculations (pure, unit tested)
lib/devices/         Device credential generation and verification
lib/services/        Server-side data access (always via the user-scoped client first)
lib/simulation/      Seeded, repeatable simulated timelines
lib/validation/      Zod schemas for user input
supabase/migrations/ Versioned schema, constraints and RLS policies
scripts/             Demo seeding and live RLS verification
lib/supabase/        Browser, server and proxy Supabase clients
lib/env.ts           Server-side configuration and integration status
proxy.ts             Refreshes the Supabase session (Next.js 16 replaces middleware with proxy)
tests/               Vitest suites
```

## License

MIT. See [LICENSE](LICENSE).
