import { NextResponse, type NextRequest } from "next/server";
import { isWellFormedCredential } from "@/lib/devices/credentials";
import { isConfigured } from "@/lib/env";
import { createRateLimiter } from "@/lib/rate-limit";
import { ingestTelemetry } from "@/lib/services/telemetry";
import { bearerToken, claimsNonDeviceSource, telemetryPayloadSchema } from "@/lib/validation/telemetry";

const perDevice = createRateLimiter({ limit: 30, windowMs: 60_000 });
const perClient = createRateLimiter({ limit: 120, windowMs: 60_000 });
const MAX_BODY_BYTES = 64 * 1024;

/**
 * Device telemetry. Authenticated with a per-device credential in the
 * Authorization header, never with a user session. Compact responses; errors
 * never echo credentials or database details.
 */
export async function POST(request: NextRequest) {
  if (!isConfigured("deviceIngestion")) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });

  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!perClient.check(client).allowed) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });

  const credential = bearerToken(request.headers.get("authorization"));
  if (!credential || !isWellFormedCredential(credential)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return NextResponse.json({ ok: false, error: "too_large" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // Simulated or manual data can never masquerade as hardware readings.
  if (claimsNonDeviceSource(body)) return NextResponse.json({ ok: false, error: "device_readings_only" }, { status: 422 });
  const parsed = telemetryPayloadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  if (!perDevice.check(parsed.data.deviceId).allowed) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const result = await ingestTelemetry(parsed.data, credential);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.error === "unauthorized" ? 401 : 500 });
  }
  return NextResponse.json({ ok: true, accepted: result.accepted, duplicates: result.duplicates, rejected: result.rejected }, { status: 201 });
}
