import "server-only";
import { redirect } from "next/navigation";
import { isConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string | null };

/**
 * Returns the signed-in user, verified server-side. getClaims() validates the
 * JWT signature, so the identity is trustworthy (unlike getSession()).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!isConfigured("supabase")) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
