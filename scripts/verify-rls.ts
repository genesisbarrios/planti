/**
 * Integration check of Row Level Security against the configured Supabase
 * project (not a mock). Creates two temporary users, exercises the policies
 * through the public API exactly as a browser would, then deletes the users
 * and everything they own.
 *
 *   npm run verify:rls
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and
 * SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `  (${detail})`}`);
}

async function signedInClient(email: string, password: string) {
  const client = createClient(url, publishableKey, opts);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed for test user: ${error.message}`);
  return client;
}

async function main() {
  if (!url || !publishableKey || !serviceKey) throw new Error("Supabase env vars are missing");
  const admin = createClient(url, serviceKey, opts);
  const tag = randomBytes(4).toString("hex");
  const password = randomBytes(18).toString("base64url");
  const userIds: string[] = [];

  try {
    const users = await Promise.all(
      ["a", "b"].map(async (who) => {
        const { data, error } = await admin.auth.admin.createUser({
          email: `planti-rls-${tag}-${who}@example.com`,
          password,
          email_confirm: true,
        });
        if (error || !data.user) throw new Error(`Could not create test user: ${error?.message}`);
        userIds.push(data.user.id);
        return data.user;
      }),
    );
    const [alice, bob] = users;
    const asAlice = await signedInClient(alice.email!, password);
    const asBob = await signedInClient(bob.email!, password);
    const anon = createClient(url, publishableKey, opts);

    // Alice creates a plant through the public API.
    const { data: plant, error: plantError } = await asAlice.from("plants").insert({ user_id: alice.id, name: "RLS check" }).select("id").single();
    check("owner can create a plant", !plantError && !!plant, plantError?.message);
    const plantId = plant!.id as string;

    // Server-side records, written with the service role as the app does.
    const { data: device } = await admin
      .from("devices")
      .insert({ plant_id: plantId, device_key_hash: "a".repeat(64), device_name: "check" })
      .select("id")
      .single();
    await admin.from("plant_assessments").insert({ plant_id: plantId, evidence: {}, trend_summary: {}, assessment: "check", confidence: "low" });

    const profile = await asAlice.from("profiles").select("id").eq("id", alice.id);
    check("profile is created automatically", profile.data?.length === 1, profile.error?.message);

    const bobPlants = await asBob.from("plants").select("id").eq("id", plantId);
    check("other users cannot read the plant", bobPlants.data?.length === 0, bobPlants.error?.message);

    const anonPlants = await anon.from("plants").select("id");
    check("anonymous requests are denied", !!anonPlants.error || anonPlants.data?.length === 0);

    const steal = await asBob.from("plants").insert({ user_id: alice.id, name: "stolen" });
    check("cannot create a plant for another user", !!steal.error);

    const bobUpdate = await asBob.from("plants").update({ name: "x" }).eq("id", plantId).select("id");
    check("other users cannot update the plant", (bobUpdate.data?.length ?? 0) === 0);

    const sim = await asAlice.from("sensor_readings").insert({ plant_id: plantId, recorded_at: new Date().toISOString(), soil_moisture_percent: 40, source: "simulated" });
    check("owner can add simulated readings", !sim.error, sim.error?.message);

    const fakeDevice = await asAlice.from("sensor_readings").insert({
      plant_id: plantId,
      device_id: device!.id,
      recorded_at: new Date().toISOString(),
      soil_moisture_percent: 40,
      source: "device",
    });
    check("browser sessions cannot write device readings", !!fakeDevice.error);

    const bobReading = await asBob.from("sensor_readings").insert({ plant_id: plantId, recorded_at: new Date().toISOString(), source: "simulated" });
    check("cannot add readings to another user's plant", !!bobReading.error);

    await admin.from("sensor_readings").insert({
      plant_id: plantId,
      device_id: device!.id,
      recorded_at: new Date(Date.now() - 60_000).toISOString(),
      soil_moisture_percent: 41,
      source: "device",
    });
    const bobDelete = await asBob.from("sensor_readings").delete().eq("plant_id", plantId).select("id");
    check("others cannot delete simulated readings", (bobDelete.data?.length ?? 0) === 0);
    const simDelete = await asAlice.from("sensor_readings").delete().eq("plant_id", plantId).eq("source", "simulated").select("id");
    check("owner can clear simulated readings", (simDelete.data?.length ?? 0) === 1, simDelete.error?.message);
    const deviceDelete = await asAlice.from("sensor_readings").delete().eq("plant_id", plantId).eq("source", "device").select("id");
    check("owner cannot delete device readings", (deviceDelete.data?.length ?? 0) === 0);

    const hash = await asAlice.from("devices").select("device_key_hash");
    check("device credential hash is not readable", !!hash.error);

    const visibleDevice = await asAlice.from("devices").select("id, device_name");
    check("owner can see their device", visibleDevice.data?.length === 1, visibleDevice.error?.message);

    const createDevice = await asAlice.from("devices").insert({ plant_id: plantId, device_key_hash: "b".repeat(64) });
    check("users cannot create devices directly", !!createDevice.error);

    const touchDevice = await asAlice.from("devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device!.id);
    check("users cannot change protected device fields", !!touchDevice.error);

    const forged = await asAlice.from("plant_assessments").insert({ plant_id: plantId, evidence: {}, trend_summary: {}, assessment: "fake", confidence: "high", ai_model: "nemotron" });
    check("users cannot forge assessments", !!forged.error);

    const aliceAssessments = await asAlice.from("plant_assessments").select("id");
    const bobAssessments = await asBob.from("plant_assessments").select("id");
    check("owner reads assessments; others cannot", aliceAssessments.data?.length === 1 && bobAssessments.data?.length === 0);

    const care = await asBob.from("care_events").insert({ plant_id: plantId, user_id: bob.id, event_type: "watered" });
    check("cannot log care on another user's plant", !!care.error);
  } finally {
    await Promise.all(userIds.map((id) => admin.auth.admin.deleteUser(id)));
    console.log(`Cleaned up ${userIds.length} temporary users (their plants cascade-delete).`);
  }

  if (failures) {
    console.error(`${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("All RLS checks passed against the live project.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
