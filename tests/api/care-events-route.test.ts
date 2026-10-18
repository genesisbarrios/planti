import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { careEventInputSchema } from "@/lib/validation/care-event";

const getCurrentUser = vi.fn();
const logCareEvent = vi.fn();

vi.mock("@/lib/auth", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/services/care-events", () => ({ logCareEvent: (...args: unknown[]) => logCareEvent(...args) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));

const { POST } = await import("@/app/api/care-events/route");

const PLANT = "6f9619ff-8b86-4011-b42d-00c04fc964ff";
const request = (body: unknown) =>
  new NextRequest("http://localhost/api/care-events", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

describe("careEventInputSchema", () => {
  it("accepts a minimal watering", () => {
    expect(careEventInputSchema.safeParse({ plantId: PLANT, eventType: "watered" }).success).toBe(true);
  });

  it("rejects future times, unknown types and out-of-range amounts", () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    expect(careEventInputSchema.safeParse({ plantId: PLANT, eventType: "watered", occurredAt: future }).success).toBe(false);
    expect(careEventInputSchema.safeParse({ plantId: PLANT, eventType: "pruned" }).success).toBe(false);
    expect(careEventInputSchema.safeParse({ plantId: PLANT, eventType: "watered", amountMl: 50_000 }).success).toBe(false);
    expect(careEventInputSchema.safeParse({ plantId: PLANT, eventType: "watered", occurredAt: "yesterday" }).success).toBe(false);
  });
});

describe("POST /api/care-events", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    logCareEvent.mockReset();
  });

  it("requires a signed-in user", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await POST(request({ plantId: PLANT, eventType: "watered" }))).status).toBe(401);
    expect(logCareEvent).not.toHaveBeenCalled();
  });

  it("validates input before writing", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", email: null });
    const res = await POST(request({ plantId: PLANT, eventType: "watered", occurredAt: new Date(Date.now() + 86_400_000).toISOString() }));
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/future/);
    expect(logCareEvent).not.toHaveBeenCalled();
  });

  it("returns 404 when the plant is not the user's", async () => {
    getCurrentUser.mockResolvedValue({ id: "u2", email: null });
    logCareEvent.mockResolvedValue({ ok: false, error: "not_found" });
    expect((await POST(request({ plantId: PLANT, eventType: "watered" }))).status).toBe(404);
  });

  it("creates the event and passes the authenticated user, not a client-supplied one", async () => {
    getCurrentUser.mockResolvedValue({ id: "u3", email: null });
    logCareEvent.mockResolvedValue({ ok: true, event: { id: "e1" } });
    const res = await POST(request({ plantId: PLANT, eventType: "watered", amountMl: 250, userId: "someone-else" }));
    expect(res.status).toBe(201);
    expect(logCareEvent.mock.calls[0][1]).toBe("u3");
    expect(logCareEvent.mock.calls[0][2]).not.toHaveProperty("userId");
  });
});
