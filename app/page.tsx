import Link from "next/link";
import { MoistureChart } from "@/components/charts/moisture-chart";
import { AnalysisPanel } from "@/components/dashboard/analysis-panel";
import { AssessmentPanel } from "@/components/dashboard/assessment-panel";
import { CareEventsPanel } from "@/components/dashboard/care-events-panel";
import { PlantHeader } from "@/components/dashboard/plant-header";
import { PlantSwitcher } from "@/components/dashboard/plant-switcher";
import { ReadingStrip } from "@/components/dashboard/reading-strip";
import { SimulatorPanel } from "@/components/dashboard/simulator-panel";
import { StateNotice } from "@/components/dashboard/state-notice";
import { MemoryPanel } from "@/components/memory/memory-panel";
import { CareEventDialog } from "@/components/care/care-event-dialog";
import { Panel } from "@/components/ui/panel";
import { loadDashboard } from "@/lib/services/dashboard";

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const { plant: plantParam } = await searchParams;
  const state = await loadDashboard(typeof plantParam === "string" ? plantParam : undefined);
  const { view } = state;
  const plant = view.plant;

  return (
    <div className="space-y-6">
      <StateNotice state={state} />
      <PlantSwitcher plants={view.plants} selectedId={plant?.id ?? null} />

      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <PlantHeader plant={plant} />
          {plant ? (
            <Link href={`/plants/${plant.id}`} className="mt-2 inline-block text-sm text-forest underline-offset-2 hover:underline">
              Profile and devices
            </Link>
          ) : null}
        </div>
        {plant ? <CareEventDialog plantId={plant.id} /> : null}
      </div>

      <ReadingStrip view={view} />

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <Panel eyebrow="History · last 7 days" title="Soil moisture" className="lg:col-span-8">
          <MoistureChart readings={view.readings} careEvents={view.careEvents} />
        </Panel>
        <div className="lg:col-span-4">
          <AssessmentPanel assessment={view.latestAssessment} plantId={plant?.id ?? null} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-8">
          <MemoryPanel narrative={view.narrative} entries={view.timeline} />
        </div>
        <div className="space-y-6 lg:col-span-4">
          <AnalysisPanel analysis={view.analysis} />
          <CareEventsPanel events={view.careEvents} />
          {plant && view.simulatorEnabled ? <SimulatorPanel plantId={plant.id} /> : null}
        </div>
      </div>
    </div>
  );
}
