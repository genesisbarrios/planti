# Planti

Planti is a plant-care agent that keeps a memory of one plant's readings and care.
It estimates when the plant may need attention, recommends a next step based on
evidence, and then checks the readings that follow to see what actually happened.

Built for the Nebius x NVIDIA Global AI Hackathon.

> **Status: Phase 1 (scaffold).** The dashboard shell, design system, Supabase
> client wiring and freshness rules are in place. The database schema,
> simulator, analysis engine, Nemotron assessments, Tavily research and
> firmware arrive in later phases. Nothing below claims more than that.

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

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generates Next.js route types, then `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run check` | Lint, typecheck and tests |

## Project layout

```
app/                 Routes (dashboard, plants, settings)
components/          UI, grouped by feature (dashboard, charts, memory, shell, ui)
lib/analysis/        Deterministic calculations (pure, unit tested)
lib/services/        Server-side data loading
lib/supabase/        Browser, server and proxy Supabase clients
lib/env.ts           Server-side configuration and integration status
proxy.ts             Refreshes the Supabase session (Next.js 16 replaces middleware with proxy)
tests/               Vitest suites
```

## License

MIT. See [LICENSE](LICENSE).
