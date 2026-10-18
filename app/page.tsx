import { MoistureChart } from "@/components/charts/moisture-chart";
import { AssessmentPanel } from "@/components/dashboard/assessment-panel";
import { CareEventsPanel } from "@/components/dashboard/care-events-panel";
import { PlantHeader } from "@/components/dashboard/plant-header";
import { ReadingStrip } from "@/components/dashboard/reading-strip";
import { StateNotice } from "@/components/dashboard/state-notice";
import { MemoryPanel } from "@/components/memory/memory-panel";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { loadDashboard } from "@/lib/services/dashboard";

export default async function DashboardPage() {
  const state = await loadDashboard();
  const { view } = state;
  const hasPlant = view.plant !== null;
  const disabledReason = hasPlant ? undefined : "Add a plant first";

  return (
    <div className="space-y-6">
      <StateNotice state={state} />

      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <PlantHeader plant={view.plant} />
        <div className="flex flex-wrap gap-2">
          {/* Wired to the care-event dialog and assessment API in later phases. */}
          <Button variant="secondary" disabled={!hasPlant} title={disabledReason}>
            Run assessment
          </Button>
          <Button disabled={!hasPlant} title={disabledReason}>
            Log watering
          </Button>
        </div>
      </div>

      <ReadingStrip view={view} />

      <div className="grid gap-6 lg:grid-cols-12">
        <Panel eyebrow="History" title="Soil moisture" className="lg:col-span-8">
          <MoistureChart readings={view.readings} careEvents={view.careEvents} />
        </Panel>
        <div className="lg:col-span-4">
          <AssessmentPanel assessment={view.latestAssessment} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <MemoryPanel outcomes={view.outcomes} />
        </div>
        <div className="lg:col-span-4">
          <CareEventsPanel events={view.careEvents} />
        </div>
      </div>
    </div>
  );
}
