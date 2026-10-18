# Model comparison: reviewer notes

These notes are from a single reviewer (the developer) reading the outputs in
[`model-comparison.md`](model-comparison.md). Each configuration ran on 5 seeded
simulator scenarios. This is a qualitative smoke check, not a statistical result.
A rubric-based human evaluation is planned separately.

## What changed between runs

The first run asked models for "a JSON object" (`response_format: json_object`).
In that run Lightning produced schema-valid output for 0/5 scenarios with
reasoning on and 2/5 with reasoning off. It listed too many facts, returned
objects instead of strings, or omitted required keys. Super passed 5/5.

Planti now sends the JSON Schema generated from its own Zod contract and asks
for strict structured decoding (`response_format: json_schema`). After that
change, all 15 runs across the three configurations were schema-valid. The
server still validates every reply with Zod.

## Observations (json_schema run)

| Configuration | Faithfulness to evidence | Labels simulated data | Unsupported claims | Latency |
| --- | --- | --- | --- | --- |
| Lightning, reasoning on | Strong; restates calculated values correctly | 5/5 | None seen | ~16 s |
| Lightning, reasoning off | Mixed | 3/5 | 2 (see below) | ~2.4 s |
| Super 120B, reasoning on | Strong, concise | 2/5 | None seen | ~6 s |

Unsupported claims from Lightning with reasoning off:

- *Gradual decline:* it said a 33% sensor reading was "below the owner's
  stated preference of allowing the top 3 cm to dry". The evidence never links
  a sensor percentage to the top 3 cm of soil.
- *Gradual decline:* it recommended watering "until modest runoff appears"
  without first checking the soil, which adds an action the evidence doesn't support.

All three configurations recommended checking the soil by hand before
watering in the stale and noisy scenarios. None of them diagnosed disease or
claimed to control the plant.

## Decision

- **Primary assessment model:** `nvidia/Nemotron-3_5-Lightning` with reasoning
  **on** (the default; `NEBIUS_ENABLE_THINKING=false` turns it off). It was the
  most faithful to the evidence and labeled simulated data most consistently.
  The ~16 s latency is acceptable for a user-initiated action that shows progress.
- **Comparison model:** `nvidia/nemotron-3-super-120b-a12b`. It was concise and
  accurate but labeled simulated data less consistently. The dashboard shows
  its own "Based on simulated readings" label regardless of the model's text.

Reproduce with `npm run compare:models`, which needs the Nebius env vars.
