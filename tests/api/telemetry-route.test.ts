import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateDeviceCredential } from "@/lib/devices/credentials";
import { checkTimestamp, telemetryPayloadSchema } from "@/lib/validation/telemetry";

const ingestTelemetry = vi.fn();
vi.mock("@/lib/services/telemetry", () => ({ ingestTelemetry: (...args: unknown[]) => ingestTelemetry(...args) }));
vi.mock("@/lib/env", () => ({ isConfigured: () => true }));

const { POST } = await import("@/app/api/telemetry/route");

const DEVICE = "6f9619ff-8b86-4011-b42d-00c04fc964ff";
const CREDENTIAL = generateDeviceCredential();
const reading = { recordedAt: new Date().toISOString(), temperatureC: 24.1, soilMoistureRaw: 512, soilMoisturePercent: 37.5, soilMoistureStatus: "unknown", source: "device" };

let ip = 0;
function request(body: unknown, auth: string | null = `Bearer ${CREDENTIAL}`) {
  const headers: Record<string, string> = { "Content-Type": "application/json", "x-forwarded-for": `10.0.0.${++ip}` };
  if (auth) headers.authorization = auth;
  return new NextRequest("http://localhost/api/telemetry", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers });
}

describe("telemetry payload", () => {
  it("accepts the single-reading form and normalizes it to a batch", () => {
    const parsed = telemetryPayloadSchema.parse({ deviceId: DEVICE, firmwareVersion: "0.1.0", ...reading });
    expect(parsed.readings).toHaveLength(1);
    expect(parsed.readings[0].soilMoisturePercent).toBe(37.5);
  });

  it("strips client-supplied ownership fields", () => {
    const parsed = telemetryPayloadSchema.parse({ deviceId: DEVICE, plantId: "someone-elses-plant", userId: "x", ...reading });
    expect(JSON.stringify(parsed)).not.toMatch(/someone-elses-plant|userId/);
  });

  it("rejects simulated readings, missing moisture and oversized batches", () => {
    expect(telemetryPayloadSchema.safeParse({ deviceId: DEVICE, ...reading, source: "simulated" }).success).toBe(false);
    expect(telemetryPayloadSchema.safeParse({ deviceId: DEVICE, ...reading, soilMoistureRaw: null, soilMoisturePercent: null }).success).toBe(false);
    expect(telemetryPayloadSchema.safeParse({ deviceId: DEVICE, readings: Array.from({ length: 51 }, () => reading) }).success).toBe(false);
    expect(telemetryPayloadSchema.safeParse({ deviceId: DEVICE, ...reading, soilMoisturePercent: 140 }).success).toBe(false);
  });

  it("flags future and stale timestamps", () => {
    const now = new Date("2026-10-18T12:00:00Z");
    expect(checkTimestamp("2026-10-18T12:30:00Z", now)).toBe("future");
    expect(checkTimestamp("2026-10-10T12:00:00Z", now)).toBe("too_old");
    expect(checkTimestamp("2026-10-18T11:59:00Z", now)).toBe("ok");
    expect(checkTimestamp(undefined, now)).toBe("ok");
  });
});

describe("POST /api/telemetry", () => {
  beforeEach(() => ingestTelemetry.mockReset());

  it("rejects requests without a well-formed device credential", async () => {
    expect((await POST(request({ deviceId: DEVICE, ...reading }, null))).status).toBe(401);
    expect((await POST(request({ deviceId: DEVICE, ...reading }, "Bearer not-a-credential"))).status).toBe(401);
    expect(ingestTelemetry).not.toHaveBeenCalled();
  });

  it("refuses simulated data on the hardware endpoint", async () => {
    const res = await POST(request({ deviceId: DEVICE, ...reading, source: "simulated" }));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ ok: false, error: "device_readings_only" });
    expect(ingestTelemetry).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON and payloads", async () => {
    expect((await POST(request("{nope"))).status).toBe(400);
    expect((await POST(request({ deviceId: "not-a-uuid", ...reading }))).status).toBe(400);
  });

  it("passes the credential to ingestion, without client ownership fields", async () => {
    ingestTelemetry.mockResolvedValue({ ok: true, accepted: 1, duplicates: 0, rejected: 0 });
    const res = await POST(request({ deviceId: DEVICE, plantId: "attacker-plant", ...reading }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, accepted: 1, duplicates: 0, rejected: 0 });
    const [payload, credential] = ingestTelemetry.mock.calls[0];
    expect(credential).toBe(CREDENTIAL);
    expect(payload).not.toHaveProperty("plantId");
  });

  it("returns 401 when the device credential does not verify", async () => {
    ingestTelemetry.mockResolvedValue({ ok: false, error: "unauthorized" });
    expect((await POST(request({ deviceId: DEVICE, ...reading }))).status).toBe(401);
  });

  it("rate-limits a single device", async () => {
    ingestTelemetry.mockResolvedValue({ ok: true, accepted: 1, duplicates: 0, rejected: 0 });
    const device = "11111111-2222-4333-8444-555555555555";
    const statuses: number[] = [];
    for (let i = 0; i < 32; i++) statuses.push((await POST(request({ deviceId: device, ...reading }))).status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(30);
    expect(statuses.slice(-2)).toEqual([429, 429]);
  });
});
