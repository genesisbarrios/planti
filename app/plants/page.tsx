import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Plants" };

export default function PlantsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-ink">Plants</h1>
        <p className="mt-1 text-sm text-ink-muted">Each plant keeps its own profile, readings and care memory.</p>
      </div>
      <EmptyState title="No plants yet">
        Adding and editing plants needs the Supabase schema, which comes next. Species and care preferences are stored as
        information you provide; Planti doesn&apos;t assume precise requirements for a species it hasn&apos;t been told about.
      </EmptyState>
    </div>
  );
}
