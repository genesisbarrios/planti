import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Skip static assets and device telemetry (devices authenticate with their
    // own credential and never carry a user session).
    "/((?!_next/static|_next/image|favicon.ico|api/telemetry|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
