import { NextResponse, type NextRequest } from "next/server";
import { assessmentRequestSchema } from "@/lib/ai/schemas";
import { getCurrentUser } from "@/lib/auth";
import { createRateLimiter } from "@/lib/rate-limit";
import { runAssessment } from "@/lib/services/assessments";
import { createClient } from "@/lib/supabase/server";

// Model calls can take a while with reasoning enabled.
export const maxDuration = 90;

const limiter = createRateLimiter({ limit: 6, windowMs: 60_000 });

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rate = limiter.check(user.id);
  if (!rate.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = assessmentRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  try {
    const result = await runAssessment(await createClient(), parsed.data.plantId, { force: parsed.data.force });
    if (result.kind === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (result.kind === "fallback") {
      // 200: the user still gets a useful, clearly labeled deterministic answer.
      return NextResponse.json({ kind: "fallback", reason: result.reason, fallback: result.fallback });
    }
    return NextResponse.json({ kind: result.kind, assessment: result.assessment });
  } catch (error) {
    console.error("POST /api/assessments failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
