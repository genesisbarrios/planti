import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, createUser } from "./harness";

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";
const HASH = "a".repeat(64);

let db: PGlite;
let alicePlant: string;
let aliceDevice: string;
let aliceAssessment: string;
let aliceRun: string;

async function rows<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  return (await db.query<T>(sql, params)).rows;
}

beforeAll(async () => {
  db = await createTestDb();
  await createUser(db, ALICE, "alice@example.com");
  await createUser(db, BOB, "bob@example.com");

  alicePlant = await as(db, "authenticated", ALICE, async () => {
    const [plant] = await rows<{ id: string }>("insert into plants (user_id, name) values ($1, 'Monstera') returning id", [ALICE]);
    return plant.id;
  });

  // Server-side (service role) writes: device, a device reading, an assessment, a research run.
  await as(db, "service_role", null, async () => {
    [{ id: aliceDevice }] = await rows<{ id: string }>(
      "insert into devices (plant_id, device_key_hash, device_name) values ($1, $2, 'T-Display') returning id",
      [alicePlant, HASH],
    );
    await rows(
      "insert into sensor_readings (plant_id, device_id, recorded_at, soil_moisture_percent, source) values ($1, $2, '2026-10-18T10:00:00Z', 41.5, 'device')",
      [alicePlant, aliceDevice],
    );
    [{ id: aliceAssessment }] = await rows<{ id: string }>(
      "insert into plant_assessments (plant_id, evidence, trend_summary, assessment, confidence) values ($1, '{}', '{}', 'ok', 'low') returning id",
      [alicePlant],
    );
    [{ id: aliceRun }] = await rows<{ id: string }>(
      "insert into research_runs (plant_id, user_id, query, research_mode, status, provider_metadata) values ($1, $2, 'monstera watering', 'search', 'completed', '{\"credits\":1}') returning id",
      [alicePlant, ALICE],
    );
    await rows("insert into research_sources (research_run_id, title, url) values ($1, 'Extension guide', 'https://extension.example.edu/monstera')", [aliceRun]);
  });
});

describe("schema", () => {
  it("creates a profile for each new auth user", async () => {
    const profiles = await rows("select id from profiles order by id");
    expect(profiles.map((p) => p.id)).toEqual([ALICE, BOB]);
  });

  it("rejects out-of-range readings and mismatched device/source pairs", async () => {
    await as(db, "service_role", null, async () => {
      await expect(
        rows("insert into sensor_readings (plant_id, recorded_at, soil_moisture_percent, source) values ($1, now(), 140, 'simulated')", [alicePlant]),
      ).rejects.toThrow();
      await expect(
        rows("insert into sensor_readings (plant_id, recorded_at, source) values ($1, now(), 'device')", [alicePlant]),
      ).rejects.toThrow(/sensor_readings_device_source/);
    });
  });

  it("rejects a replayed device reading with the same timestamp", async () => {
    await as(db, "service_role", null, async () => {
      await expect(
        rows(
          "insert into sensor_readings (plant_id, device_id, recorded_at, soil_moisture_percent, source) values ($1, $2, '2026-10-18T10:00:00Z', 41.5, 'device')",
          [alicePlant, aliceDevice],
        ),
      ).rejects.toThrow(/duplicate key/);
    });
  });
});

describe("plants RLS", () => {
  it("lets the owner read their plant and hides it from others", async () => {
    expect(await as(db, "authenticated", ALICE, () => rows("select id from plants"))).toHaveLength(1);
    expect(await as(db, "authenticated", BOB, () => rows("select id from plants"))).toHaveLength(0);
  });

  it("prevents creating a plant for another user", async () => {
    await expect(
      as(db, "authenticated", BOB, () => rows("insert into plants (user_id, name) values ($1, 'Stolen')", [ALICE])),
    ).rejects.toThrow(/row-level security/);
  });

  it("prevents others from updating or deleting a plant", async () => {
    const updated = await as(db, "authenticated", BOB, () => rows("update plants set name = 'x' where id = $1 returning id", [alicePlant]));
    const deleted = await as(db, "authenticated", BOB, () => rows("delete from plants where id = $1 returning id", [alicePlant]));
    expect(updated).toHaveLength(0);
    expect(deleted).toHaveLength(0);
  });

  it("prevents the owner from handing a plant to another user", async () => {
    await expect(
      as(db, "authenticated", ALICE, () => rows("update plants set user_id = $1 where id = $2", [BOB, alicePlant])),
    ).rejects.toThrow(/row-level security/);
  });

  it("gives anonymous requests no access", async () => {
    await expect(as(db, "anon", null, () => rows("select id from plants"))).rejects.toThrow(/permission denied/);
  });
});

describe("sensor readings RLS", () => {
  it("lets the owner read readings and hides them from others", async () => {
    expect(await as(db, "authenticated", ALICE, () => rows("select id from sensor_readings"))).toHaveLength(1);
    expect(await as(db, "authenticated", BOB, () => rows("select id from sensor_readings"))).toHaveLength(0);
  });

  it("allows simulated readings for the owner's plant", async () => {
    const inserted = await as(db, "authenticated", ALICE, () =>
      rows("insert into sensor_readings (plant_id, recorded_at, soil_moisture_percent, source) values ($1, now(), 40, 'simulated') returning id", [alicePlant]),
    );
    expect(inserted).toHaveLength(1);
  });

  it("never lets a browser session write device readings", async () => {
    await expect(
      as(db, "authenticated", ALICE, () =>
        rows("insert into sensor_readings (plant_id, device_id, recorded_at, source) values ($1, $2, now(), 'device')", [alicePlant, aliceDevice]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("lets owners delete simulated readings but never device readings", async () => {
    const simDeleted = await as(db, "authenticated", ALICE, () =>
      rows("delete from sensor_readings where plant_id = $1 and source = 'simulated' returning id", [alicePlant]),
    );
    expect(simDeleted.length).toBeGreaterThan(0);
    const deviceDeleted = await as(db, "authenticated", ALICE, () =>
      rows("delete from sensor_readings where plant_id = $1 and source = 'device' returning id", [alicePlant]),
    );
    expect(deviceDeleted).toHaveLength(0);
    expect(await rows("select id from sensor_readings where source = 'device'")).toHaveLength(1);
  });

  it("does not let others delete an owner's simulated readings", async () => {
    await as(db, "authenticated", ALICE, () =>
      rows("insert into sensor_readings (plant_id, recorded_at, source) values ($1, now(), 'simulated')", [alicePlant]),
    );
    const deleted = await as(db, "authenticated", BOB, () => rows("delete from sensor_readings returning id"));
    expect(deleted).toHaveLength(0);
  });

  it("blocks readings for someone else's plant", async () => {
    await expect(
      as(db, "authenticated", BOB, () =>
        rows("insert into sensor_readings (plant_id, recorded_at, source) values ($1, now(), 'simulated')", [alicePlant]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("devices RLS", () => {
  it("shows the owner their device but never the credential hash", async () => {
    const visible = await as(db, "authenticated", ALICE, () => rows("select id, device_name from devices"));
    expect(visible).toHaveLength(1);
    await expect(as(db, "authenticated", ALICE, () => rows("select device_key_hash from devices"))).rejects.toThrow(/permission denied/);
  });

  it("does not let users create devices or change protected fields", async () => {
    await expect(
      as(db, "authenticated", ALICE, () => rows("insert into devices (plant_id, device_key_hash) values ($1, $2)", [alicePlant, HASH])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(db, "authenticated", ALICE, () => rows("update devices set last_seen_at = now() where id = $1", [aliceDevice])),
    ).rejects.toThrow(/permission denied/);
  });

  it("hides devices from other users", async () => {
    expect(await as(db, "authenticated", BOB, () => rows("select id from devices"))).toHaveLength(0);
  });
});

describe("care events RLS", () => {
  it("lets the owner log care and blocks others", async () => {
    const logged = await as(db, "authenticated", ALICE, () =>
      rows("insert into care_events (plant_id, user_id, event_type, amount_ml) values ($1, $2, 'watered', 250) returning id", [alicePlant, ALICE]),
    );
    expect(logged).toHaveLength(1);
    await expect(
      as(db, "authenticated", BOB, () =>
        rows("insert into care_events (plant_id, user_id, event_type) values ($1, $2, 'watered')", [alicePlant, BOB]),
      ),
    ).rejects.toThrow(/row-level security/);
    expect(await as(db, "authenticated", BOB, () => rows("select id from care_events"))).toHaveLength(0);
  });
});

describe("assessments and research RLS", () => {
  it("lets owners read assessments but not forge them", async () => {
    expect(await as(db, "authenticated", ALICE, () => rows("select id from plant_assessments"))).toHaveLength(1);
    expect(await as(db, "authenticated", BOB, () => rows("select id from plant_assessments"))).toHaveLength(0);
    await expect(
      as(db, "authenticated", ALICE, () =>
        rows("insert into plant_assessments (plant_id, evidence, trend_summary, assessment, confidence, ai_model) values ($1, '{}', '{}', 'fake', 'high', 'nemotron')", [alicePlant]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("lets owners read outcomes but never write them", async () => {
    await as(db, "service_role", null, () =>
      rows("insert into intervention_outcomes (plant_id, outcome, explanation) values ($1, 'pending_observation', 'server')", [alicePlant]),
    );
    expect(await as(db, "authenticated", ALICE, () => rows("select id from intervention_outcomes"))).toHaveLength(1);
    expect(await as(db, "authenticated", BOB, () => rows("select id from intervention_outcomes"))).toHaveLength(0);
    await expect(
      as(db, "authenticated", ALICE, () =>
        rows("insert into intervention_outcomes (plant_id, outcome) values ($1, 'moisture_increase_observed')", [alicePlant]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(db, "authenticated", ALICE, () => rows("update intervention_outcomes set outcome = 'moisture_increase_observed'")),
    ).rejects.toThrow(/permission denied/);
  });

  it("traverses ownership from research sources to the plant", async () => {
    expect(await as(db, "authenticated", ALICE, () => rows("select id from research_sources"))).toHaveLength(1);
    expect(await as(db, "authenticated", BOB, () => rows("select id from research_sources"))).toHaveLength(0);
  });

  it("keeps provider metadata server-side", async () => {
    expect(await as(db, "authenticated", ALICE, () => rows("select id, query from research_runs"))).toHaveLength(1);
    await expect(as(db, "authenticated", ALICE, () => rows("select provider_metadata from research_runs"))).rejects.toThrow(/permission denied/);
  });

  it("reads assessment evidence only for owned assessments", async () => {
    await as(db, "service_role", null, () =>
      rows("insert into assessment_evidence (assessment_id, evidence_type, claim) values ($1, 'measurement', 'Moisture fell')", [aliceAssessment]),
    );
    expect(await as(db, "authenticated", ALICE, () => rows("select id from assessment_evidence"))).toHaveLength(1);
    expect(await as(db, "authenticated", BOB, () => rows("select id from assessment_evidence"))).toHaveLength(0);
  });
});
