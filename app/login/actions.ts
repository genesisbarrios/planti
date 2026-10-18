"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = { error?: string; message?: string; email?: string };

const credentialsSchema = z.object({
  email: z.email("Enter a valid email address").max(254),
  password: z.string().min(8, "Use at least 8 characters").max(128),
});

function parse(formData: FormData) {
  return credentialsSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, email: String(formData.get("email") ?? "") };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Generic message: do not reveal whether the account exists.
    return { error: "Email or password is incorrect, or the email is not confirmed yet.", email: parsed.data.email };
  }
  redirect("/");
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, email: String(formData.get("email") ?? "") };

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${appUrl}/auth/confirm` },
  });
  if (error) return { error: "Could not create the account. Try a different email or password.", email: parsed.data.email };

  // With email confirmation on, there is no session until the link is opened.
  if (!data.session) {
    return { message: "Check your email for a confirmation link, then sign in.", email: parsed.data.email };
  }
  redirect("/plants/new");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
