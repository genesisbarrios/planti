import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isConfigured } from "@/lib/env";
import { EmptyState } from "@/components/ui/empty-state";
import { AuthForm } from "./auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (!isConfigured("supabase")) {
    return (
      <div className="mx-auto max-w-md pt-10">
        <EmptyState title="Supabase is not configured">Sign-in needs the Supabase URL and publishable key in .env.local.</EmptyState>
      </div>
    );
  }
  if (await getCurrentUser()) redirect("/");

  return (
    <div className="mx-auto max-w-md pt-6 sm:pt-12">
      <h1 className="font-serif text-3xl text-ink">Welcome to Planti</h1>
      <p className="mb-6 mt-1.5 text-sm leading-relaxed text-ink-muted">
        Your plants, their readings and their care history are private to your account.
      </p>
      <AuthForm />
    </div>
  );
}
