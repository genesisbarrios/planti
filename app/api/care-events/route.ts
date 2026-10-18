import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createRateLimiter } from "@/lib/rate-limit";
import { logCareEvent } from "@/lib/services/care-events";
import { createClient } from "@/lib/supabase/server";
import { careEventInputSchema } from "@/lib/validation/care-event";

const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!limiter.check(user.id).allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = careEventInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", message: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const result = await logCareEvent(await createClient(), user.id, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === "not_found" ? 404 : 500 });
  }
  return NextResponse.json({ event: result.event }, { status: 201 });
}
