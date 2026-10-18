/**
 * Seeds a clearly labeled SIMULATED demo plant for an existing Planti user.
 *
 *   npm run seed:demo -- --email you@example.com [--reset]
 *
 * Every reading is stored with source = 'simulated' and the care event carries
 * metadata.simulated = true, so the UI labels it as simulated. Requires
 * NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { createClient } from "@supabase/supabase-js";
import { generateScenario } from "../lib/simulation/scenarios";

const DEMO_PLANT_NAME = "Demo plant (simulated data)";
const SEED = 20261018;

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.toLowerCase();
  const reset = process.argv.includes("--reset");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!email) throw new Error("Pass --email <address of an existing Planti account>");
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  let userId: string | undefined;
  for (let page = 1; !userId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Could not list users: ${error.message}`);
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (data.users.length < 200) break;
  }
  if (!userId) throw new Error(`No user with email ${email}. Sign up in the app first.`);

  const { data: existing } = await admin.from("plants").select("id").eq("user_id", userId).eq("name", DEMO_PLANT_NAME);
  if (existing?.length) {
    if (!reset) throw new Error(`"${DEMO_PLANT_NAME}" already exists. Re-run with --reset to replace it.`);
    await admin.from("plants").delete().in("id", existing.map((p) => p.id));
  }

  const { data: plant, error: plantError } = await admin
    .from("plants")
    .insert({
      user_id: userId,
      name: DEMO_PLANT_NAME,
      species: null,
      location: "Simulator",
      notes: "All readings and care events for this plant are simulated for demonstration. None were measured.",
    })
    .select("id")
    .single();
  if (plantError || !plant) throw new Error(`Could not create plant: ${plantError?.message}`);

  const timeline = generateScenario("watering_response", { end: new Date(), seed: SEED });
  const metadata = { simulated: true, scenario: timeline.scenario, seed: timeline.seed };

  const { error: readingsError } = await admin.from("sensor_readings").insert(
    timeline.readings.map((r) => ({
      plant_id: plant.id,
      recorded_at: r.recordedAt,
      soil_moisture_percent: r.soilMoisturePercent,
      temperature_c: r.temperatureC,
      soil_moisture_status: r.soilMoistureStatus,
      source: "simulated",
      metadata,
    })),
  );
  if (readingsError) throw new Error(`Could not insert readings: ${readingsError.message}`);

  const { error: careError } = await admin.from("care_events").insert(
    timeline.careEvents.map((e) => ({
      plant_id: plant.id,
      user_id: userId,
      event_type: e.eventType,
      occurred_at: e.occurredAt,
      amount_ml: e.amountMl,
      notes: "Simulated demo event",
      metadata,
    })),
  );
  if (careError) throw new Error(`Could not insert care events: ${careError.message}`);

  console.log(`Seeded "${DEMO_PLANT_NAME}" with ${timeline.readings.length} simulated readings and ${timeline.careEvents.length} care event.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
