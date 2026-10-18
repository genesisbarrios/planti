import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdminEnv } from "@/lib/env";

/**
 * Service-role client. It BYPASSES Row Level Security, so it is used only for
 * writes the database deliberately forbids to browsers:
 *   - device telemetry, after the device credential is verified;
 *   - device provisioning, assessments, outcomes and research records, after
 *     the caller's ownership of the plant is verified with the user client.
 * Never import this from client code, and never pass user-chosen IDs to it
 * without that verification.
 */
export function createAdminClient() {
  const { url, serviceRoleKey } = supabaseAdminEnv();
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
