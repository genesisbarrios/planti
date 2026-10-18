import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "@/lib/env";

/**
 * Supabase client for Server Components, Server Functions and Route Handlers.
 * Acts as the signed-in user via cookie sessions, so RLS applies. Create a new
 * client per request; never share one across requests.
 */
export async function createClient() {
  const { url, publishableKey } = supabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot set cookies. The session is refreshed in
          // proxy.ts, so ignoring the write here is safe.
        }
      },
    },
  });
}
