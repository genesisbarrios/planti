import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const runAssessment = vi.fn();

vi.mock("@/lib/auth", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/services/assessments", () => ({ runAssessment: (...args: unknown[]) => runAssessment(...args) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));

const { POST } = await import("@/app/api/assessments/route");

const PLANT = "6f9619ff-8b86-4011-b42d-00c04fc964ff";
const request = (body: unknown) =>
  new NextRequest("http://localhost/api/assessments", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

describe("POST /api/assessments", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    runAssessment.mockReset();
  });

  it("rejects unauthenticated requests without touching the model", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await POST(request({ plantId: PLANT }));
    expect(res.status).toBe(401);
    expect(runAssessment).not.toHaveBeenCalled();
  });

  it("rejects invalid bodies", async () => {
    getCurrentUser.mockResolvedValue({ id: "user-invalid", email: null });
    expect((await POST(request("not json"))).status).toBe(400);
    expect((await POST(request({ plantId: "not-a-uuid" }))).status).toBe(400);
    expect(runAssessment).not.toHaveBeenCalled();
  });

  it("returns 404 for a plant the user does not own", async () => {
    getCurrentUser.mockResolvedValue({ id: "user-404", email: null });
    runAssessment.mockResolvedValue({ kind: "not_found" });
    expect((await POST(request({ plantId: PLANT }))).status).toBe(404);
  });

  it("returns a labeled fallback when the model fails", async () => {
    getCurrentUser.mockResolvedValue({ id: "user-fallback", email: null });
    runAssessment.mockResolvedValue({ kind: "fallback", reason: "timeout", fallback: { assessment: "a", recommendedAction: "b" }, analysis: {} });
    const res = await POST(request({ plantId: PLANT }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ kind: "fallback", reason: "timeout" });
  });

  it("rate-limits repeated requests per user", async () => {
    getCurrentUser.mockResolvedValue({ id: "user-rate", email: null });
    runAssessment.mockResolvedValue({ kind: "reused", assessment: {} });
    const statuses = [];
    for (let i = 0; i < 8; i++) statuses.push((await POST(request({ plantId: PLANT }))).status);
    expect(statuses.slice(0, 6).every((s) => s === 200)).toBe(true);
    expect(statuses.slice(6)).toEqual([429, 429]);
  });

  it("hides internal errors behind a generic response", async () => {
    getCurrentUser.mockResolvedValue({ id: "user-error", email: null });
    runAssessment.mockRejectedValue(new Error("relation plant_assessments: secret detail"));
    const res = await POST(request({ plantId: PLANT }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret|relation/);
  });
});
