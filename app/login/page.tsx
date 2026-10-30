import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isConfigured } from "@/lib/env";
import { EmptyState } from "@/components/ui/empty-state";
import { AuthForm } from "./auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { mode } = await searchParams;
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
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-forest">Planti</p>
      <h1 className="mt-1 font-display font-semibold text-4xl leading-tight text-ink">Less guessing. More growing.</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">
        An intelligent plant-care agent that learns from your plant&apos;s history, combines real-time sensor data with trusted
        horticultural research, and helps you understand what your plants need.
      </p>
      <p className="mb-6 mt-2 text-sm leading-relaxed text-ink-muted">
        Your plants, their readings and their care history are private to your account.
      </p>
      <AuthForm initialMode={mode === "sign-up" ? "sign-up" : "sign-in"} />
    </div>
  );
}
