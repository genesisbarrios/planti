/**
 * Domain types mirroring the Supabase schema (snake_case columns are mapped to
 * camelCase at the service boundary). Timestamps are ISO-8601 UTC strings.
 */

export type ReadingSource = "device" | "simulated" | "manual";

export const MOISTURE_STATUSES = ["dry", "adequate", "wet", "unknown"] as const;
export type MoistureStatus = (typeof MOISTURE_STATUSES)[number];

export type Confidence = "low" | "medium" | "high";

export type CareEventType = "watered" | "fertilized" | "moved" | "repotted" | "other";

export type Plant = {
  id: string;
  name: string;
  species: string | null;
  location: string | null;
  lightConditions: string | null;
  potNotes: string | null;
  carePreferences: Record<string, unknown>;
  plantedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SensorReading = {
  id: number;
  plantId: string;
  deviceId: string | null;
  recordedAt: string;
  temperatureC: number | null;
  soilMoistureRaw: number | null;
  soilMoisturePercent: number | null;
  soilMoistureStatus: MoistureStatus;
  source: ReadingSource;
};

export type Device = {
  id: string;
  plantId: string;
  deviceName: string | null;
  firmwareVersion: string | null;
  lastSeenAt: string | null;
  createdAt: string;
};

export type CareEvent = {
  id: string;
  plantId: string;
  eventType: CareEventType;
  occurredAt: string;
  amountMl: number | null;
  notes: string | null;
};

export type Assessment = {
  id: string;
  plantId: string;
  createdAt: string;
  aiModel: string | null;
  assessment: string;
  recommendedAction: string | null;
  confidence: Confidence;
  reasons: string[];
  limitations: string[];
};

export type InterventionOutcomeKind =
  | "pending_observation"
  | "moisture_increase_observed"
  | "no_measurable_change"
  | "inconclusive";

export type InterventionOutcome = {
  id: string;
  plantId: string;
  careEventId: string | null;
  observedAt: string;
  outcome: InterventionOutcomeKind;
  explanation: string | null;
};
