import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeviceList } from "@/components/devices/device-list";
import { ProvisionDeviceForm } from "@/components/devices/provision-device-form";
import { PlantForm } from "@/components/plants/plant-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { classifyFreshness } from "@/lib/analysis/freshness";
import { requireUser } from "@/lib/auth";
import { deviceOnlineThresholdMinutes, isConfigured } from "@/lib/env";
import { toDeviceStatus } from "@/lib/services/dashboard";
import { latestReadingAtByDevice, listDevices } from "@/lib/services/devices";
import { getOwnedPlant } from "@/lib/services/plants";
import { createClient } from "@/lib/supabase/server";
import { deleteDeviceAction, provisionDeviceAction, updatePlantAction } from "../actions";

export const metadata: Metadata = { title: "Plant" };

export default async function PlantPage({ params }: PageProps<"/plants/[plantId]">) {
  await requireUser();
  const { plantId } = await params;
  const supabase = await createClient();
  const plant = await getOwnedPlant(supabase, plantId);
  if (!plant) notFound();

  const now = new Date();
  const threshold = deviceOnlineThresholdMinutes();
  const devices = await listDevices(supabase, plant.id);
  const latest = await latestReadingAtByDevice(supabase, devices.map((d) => d.id));
  const statuses = devices.map((d) => toDeviceStatus(d, latest.get(d.id) ?? null, now, threshold));
  const ageMinutesById = Object.fromEntries(
    statuses.map((d) => [d.id, classifyFreshness(d.latestReadingAt, now, threshold).ageMinutes]),
  );
  const canProvision = isConfigured("deviceIngestion");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/plants" className="text-sm text-ink-muted hover:text-ink">← Plants</Link>
          <h1 className="mt-1 font-serif text-3xl text-ink">{plant.name}</h1>
        </div>
        <Link href={`/?plant=${plant.id}`} className="text-sm font-medium text-forest underline-offset-2 hover:underline">
          Open on dashboard
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-card border border-line bg-surface p-5 sm:p-8 lg:col-span-7">
          <PlantForm action={updatePlantAction.bind(null, plant.id)} plant={plant} submitLabel="Save changes" />
        </div>

        <div className="lg:col-span-5">
          <Panel eyebrow="Hardware" title="Devices">
            <div className="space-y-6">
              {statuses.length ? (
                <DeviceList
                  devices={statuses}
                  onlineThresholdMinutes={threshold}
                  ageMinutesById={ageMinutesById}
                  removeAction={deleteDeviceAction.bind(null, plant.id)}
                />
              ) : (
                <EmptyState title="No device paired" compact>
                  Pair the T-Display S3 to send live readings for this plant. Until then you can use simulated data.
                </EmptyState>
              )}
              {canProvision ? (
                <ProvisionDeviceForm action={provisionDeviceAction.bind(null, plant.id)} />
              ) : (
                <p className="text-sm text-ink-muted">
                  Pairing devices needs <code className="font-mono">DEVICE_INGESTION_SECRET</code> and{" "}
                  <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> on the server.
                </p>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
