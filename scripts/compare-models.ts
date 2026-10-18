/**
 * Runs real Nebius Token Factory inference on the same evidence with the
 * primary model and the comparison model, and records schema validity,
 * latency, token use and confidence capping. Evidence comes from the seeded
 * simulator scenarios, so runs are reproducible and contain no user data.
 *
 *   npm run compare:models
 *
 * Writes docs/evaluation/model-comparison.json and .md.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assessWithModel, type AssessOutcome } from "../lib/ai/assess";
import { buildEvidence } from "../lib/ai/evidence";
import { analyzePlant } from "../lib/analysis/analyze";
import { generateScenario, SCENARIOS, type ScenarioId } from "../lib/simulation/scenarios";
import type { CareEvent, Plant, SensorReading } from "../lib/types/domain";

const apiKey = process.env.NEBIUS_API_KEY;
const baseUrl = process.env.NEBIUS_BASE_URL;
const primary = process.env.NEBIUS_MODEL;
const comparison = process.env.NEBIUS_MODEL_SUPER;
if (!apiKey || !baseUrl || !primary) throw new Error("NEBIUS_API_KEY, NEBIUS_BASE_URL and NEBIUS_MODEL are required");

const NOW = new Date("2026-10-18T12:00:00.000Z");
const plant: Plant = {
  id: "eval-plant",
  name: "Evaluation plant",
  species: "Monstera deliciosa",
  location: "Living room, east window",
  lightConditions: "Bright indirect light",
  potNotes: "20 cm plastic nursery pot, chunky aroid mix",
  carePreferences: { watering: "When the top 3 cm feel dry" },
  plantedAt: null,
  notes: null,
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
};

const runs = [
  { label: `${primary} (reasoning on)`, model: primary, thinking: true },
  { label: `${primary} (reasoning off)`, model: primary, thinking: false },
  ...(comparison ? [{ label: `${comparison} (reasoning on)`, model: comparison, thinking: true }] : []),
];

type Row = { scenario: ScenarioId; run: string; calculatedConfidence: string; outcome: AssessOutcome };

async function main() {
  const rows: Row[] = [];
  for (const scenario of Object.keys(SCENARIOS) as ScenarioId[]) {
    const t = generateScenario(scenario, { end: NOW, seed: 20261018 });
    const readings: SensorReading[] = t.readings.map((r, i) => ({
      id: i + 1,
      plantId: plant.id,
      deviceId: null,
      recordedAt: r.recordedAt,
      temperatureC: r.temperatureC,
      soilMoistureRaw: null,
      soilMoisturePercent: r.soilMoisturePercent,
      soilMoistureStatus: r.soilMoistureStatus,
      source: "simulated",
    }));
    const careEvents: CareEvent[] = t.careEvents.map((e, i) => ({ id: `c${i}`, plantId: plant.id, eventType: e.eventType, occurredAt: e.occurredAt, amountMl: e.amountMl, notes: null }));
    const analysis = analyzePlant({ readings, careEvents, now: NOW });
    const evidence = buildEvidence({ plant, analysis, readings, careEvents, priorAssessments: [], now: NOW });

    for (const run of runs) {
      const outcome = await assessWithModel({
        evidence,
        calculatedConfidence: analysis.confidence,
        config: { apiKey: apiKey!, baseUrl: baseUrl!, model: run.model, thinking: run.thinking, timeoutMs: 120_000 },
      });
      rows.push({ scenario, run: run.label, calculatedConfidence: analysis.confidence, outcome });
      const status = outcome.ok ? `valid, confidence ${outcome.output.confidence}${outcome.confidenceCapped ? " (capped)" : ""}` : `FAILED: ${outcome.reason} ${outcome.detail ?? ""}`;
      console.log(`${scenario.padEnd(18)} ${run.label.padEnd(52)} ${String(outcome.meta.latencyMs).padStart(6)} ms  ${status}`);
    }
  }

  const dir = join(process.cwd(), "docs", "evaluation");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "model-comparison.json"), JSON.stringify({ generatedAt: new Date().toISOString(), evidenceAnchor: NOW.toISOString(), rows }, null, 2));

  const summary = runs.map((run) => {
    const mine = rows.filter((r) => r.run === run.label);
    const ok = mine.filter((r) => r.outcome.ok);
    const lat = mine.map((r) => r.outcome.meta.latencyMs).sort((a, b) => a - b);
    const tokens = ok.map((r) => r.outcome.meta.usage?.completionTokens ?? 0);
    return {
      run: run.label,
      valid: `${ok.length}/${mine.length}`,
      medianLatencyMs: lat[Math.floor(lat.length / 2)],
      meanCompletionTokens: tokens.length ? Math.round(tokens.reduce((a, b) => a + b, 0) / tokens.length) : null,
      capped: ok.filter((r) => r.outcome.ok && r.outcome.confidenceCapped).length,
    };
  });

  const md = [
    "# Model comparison",
    "",
    `Generated ${new Date().toISOString()} by \`npm run compare:models\`. Real inference through Nebius Token Factory on evidence built from the five seeded simulator scenarios (no user data). Sample size is 5 scenarios per configuration, which is too small for statistical claims; this is a smoke-level quality and latency comparison.`,
    "",
    "| Configuration | Schema-valid | Median latency | Mean completion tokens | Confidence capped |",
    "| --- | --- | --- | --- | --- |",
    ...summary.map((s) => `| ${s.run} | ${s.valid} | ${s.medianLatencyMs} ms | ${s.meanCompletionTokens ?? "—"} | ${s.capped} |`),
    "",
    "## Outputs by scenario",
    "",
    ...(Object.keys(SCENARIOS) as ScenarioId[]).flatMap((scenario) => [
      `### ${SCENARIOS[scenario].label}`,
      "",
      `Calculated confidence: **${rows.find((r) => r.scenario === scenario)?.calculatedConfidence}**`,
      "",
      ...rows
        .filter((r) => r.scenario === scenario)
        .flatMap((r) =>
          r.outcome.ok
            ? [
                `**${r.run}** (${r.outcome.meta.latencyMs} ms, confidence ${r.outcome.output.confidence}${r.outcome.confidenceCapped ? ", capped" : ""})`,
                "",
                `> ${r.outcome.output.assessment}`,
                ">",
                `> **Next step:** ${r.outcome.output.recommended_action}`,
                "",
              ]
            : [`**${r.run}**: failed (${r.outcome.reason}${r.outcome.detail ? `: ${r.outcome.detail}` : ""})`, ""],
        ),
    ]),
  ].join("\n");
  writeFileSync(join(dir, "model-comparison.md"), md);
  console.log("\nSummary:");
  console.table(summary);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
