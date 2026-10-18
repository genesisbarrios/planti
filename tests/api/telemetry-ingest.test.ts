import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateDeviceCredential, hashDeviceCredential } from "@/lib/devices/credentials";
import type { TelemetryPayload } from "@/lib/validation/telemetry";

const SECRET = "0123456789abcdef0123456789abcdef";
const DEVICE = "6f9619ff-8b86-4011-b42d-00c04fc964ff";
const PLANT = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const credential = generateDeviceCredential();

/** Minimal fake of the query builder calls ingestTelemetry makes. */
const db = {
  device: null as null | { id: string; plant_id: string; device_key_hash: string },
  inserted: [] as Record<string, unknown>[],
  seen: new Set<string>(),
  deviceUpdate: null as Record<string, unknown> | null,
};
function fakeAdmin() {
  return {
    from(table: string) {
      if (table === "devices") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: db.device, error: null }) }) }),
          update: (values: Record<string, unknown>) => ({
            eq: async () => {
              db.deviceUpdate = values;
              return { error: null };
            },
          }),
        };
      }
      return {
        insert: async (row: Record<string, unknown>) => {
          const key = `${row.device_id}@${row.recorded_at}`;
          if (db.seen.has(key)) return { error: { code: "23505" } };
          db.seen.add(key);
          db.inserted.push(row);
          return { error: null };
        },
      };
    },
  };
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fakeAdmin() }));
vi.mock("@/lib/env", () => ({ deviceIngestionSecret: () => SECRET }));
const refreshOutcomes = vi.fn(async () => ({ inserted: 0, updated: 0 }));
vi.mock("@/lib/services/outcomes", () => ({ refreshOutcomes: (...a: unknown[]) => refreshOutcomes(...(a as [])) }));

const { ingestTelemetry } = await import("@/lib/services/telemetry");

const NOW = new Date("2026-10-18T12:00:00.000Z");
const payload = (readings: TelemetryPayload["readings"]): TelemetryPayload => ({ deviceId: DEVICE, firmwareVersion: "0.1.0", readings });
const r = (recordedAt?: string) => ({ recordedAt, soilMoistureRaw: 500, soilMoisturePercent: 40, soilMoistureStatus: "unknown" as const, source: "device" as const, temperatureC: 22 });

describe("ingestTelemetry", () => {
  beforeEach(() => {
    db.device = { id: DEVICE, plant_id: PLANT, device_key_hash: hashDeviceCredential(credential, SECRET) };
    db.inserted = [];
    db.seen = new Set();
    db.deviceUpdate = null;
    refreshOutcomes.mockClear();
  });

  it("rejects an unknown device and a wrong credential the same way", async () => {
    db.device = null;
    expect(await ingestTelemetry(payload([r()]), credential, NOW)).toEqual({ ok: false, error: "unauthorized" });
    db.device = { id: DEVICE, plant_id: PLANT, device_key_hash: hashDeviceCredential(credential, SECRET) };
    expect(await ingestTelemetry(payload([r()]), generateDeviceCredential(), NOW)).toEqual({ ok: false, error: "unauthorized" });
    expect(db.inserted).toHaveLength(0);
  });

  it("stores readings against the device's own plant as source=device", async () => {
    const result = await ingestTelemetry(payload([r("2026-10-18T11:55:00Z")]), credential, NOW);
    expect(result).toEqual({ ok: true, accepted: 1, duplicates: 0, rejected: 0 });
    expect(db.inserted[0]).toMatchObject({ plant_id: PLANT, device_id: DEVICE, source: "device", recorded_at: "2026-10-18T11:55:00Z" });
    expect(db.deviceUpdate).toMatchObject({ last_seen_at: NOW.toISOString(), firmware_version: "0.1.0" });
    expect(refreshOutcomes).toHaveBeenCalledOnce();
  });

  it("counts replayed readings as duplicates instead of storing them twice", async () => {
    await ingestTelemetry(payload([r("2026-10-18T11:55:00Z")]), credential, NOW);
    const replay = await ingestTelemetry(payload([r("2026-10-18T11:55:00Z"), r("2026-10-18T11:56:00Z")]), credential, NOW);
    expect(replay).toEqual({ ok: true, accepted: 1, duplicates: 1, rejected: 0 });
    expect(db.inserted).toHaveLength(2);
  });

  it("rejects readings from the future or too far in the past", async () => {
    const result = await ingestTelemetry(payload([r("2026-10-18T13:00:00Z"), r("2026-10-01T00:00:00Z"), r()]), credential, NOW);
    expect(result).toEqual({ ok: true, accepted: 1, duplicates: 0, rejected: 2 });
    expect(db.inserted[0].recorded_at).toBe(NOW.toISOString());
  });
});
