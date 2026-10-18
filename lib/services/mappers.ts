import type {
  Assessment,
  CareEvent,
  CareEventType,
  Confidence,
  Device,
  InterventionOutcome,
  InterventionOutcomeKind,
  MoistureStatus,
  Plant,
  ReadingSource,
  SensorReading,
} from "@/lib/types/domain";

/** Row shapes as returned by PostgREST (snake_case). */
export type PlantRow = {
  id: string;
  name: string;
  species: string | null;
  location: string | null;
  light_conditions: string | null;
  pot_notes: string | null;
  care_preferences: Record<string, unknown> | null;
  planted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SensorReadingRow = {
  id: number;
  plant_id: string;
  device_id: string | null;
  recorded_at: string;
  temperature_c: number | null;
  soil_moisture_raw: number | null;
  soil_moisture_percent: number | null;
  soil_moisture_status: string;
  source: string;
};

export type DeviceRow = {
  id: string;
  plant_id: string;
  device_name: string | null;
  firmware_version: string | null;
  last_seen_at: string | null;
  created_at: string;
};

export type CareEventRow = {
  id: string;
  plant_id: string;
  event_type: string;
  occurred_at: string;
  amount_ml: number | null;
  notes: string | null;
};

export type AssessmentRow = {
  id: string;
  plant_id: string;
  created_at: string;
  ai_model: string | null;
  assessment: string;
  recommended_action: string | null;
  confidence: string;
  reasons: unknown;
  limitations: unknown;
};

export type OutcomeRow = {
  id: string;
  plant_id: string;
  care_event_id: string | null;
  observed_at: string;
  outcome: string;
  explanation: string | null;
};

export const PLANT_COLUMNS =
  "id, name, species, location, light_conditions, pot_notes, care_preferences, planted_at, notes, created_at, updated_at";
export const READING_COLUMNS =
  "id, plant_id, device_id, recorded_at, temperature_c, soil_moisture_raw, soil_moisture_percent, soil_moisture_status, source";
// Never includes device_key_hash: the authenticated role cannot select it.
export const DEVICE_COLUMNS = "id, plant_id, device_name, firmware_version, last_seen_at, created_at";
export const CARE_EVENT_COLUMNS = "id, plant_id, event_type, occurred_at, amount_ml, notes";
export const ASSESSMENT_COLUMNS =
  "id, plant_id, created_at, ai_model, assessment, recommended_action, confidence, reasons, limitations";
export const OUTCOME_COLUMNS = "id, plant_id, care_event_id, observed_at, outcome, explanation";

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

export function toPlant(row: PlantRow): Plant {
  return {
    id: row.id,
    name: row.name,
    species: row.species,
    location: row.location,
    lightConditions: row.light_conditions,
    potNotes: row.pot_notes,
    carePreferences: row.care_preferences ?? {},
    plantedAt: row.planted_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toReading(row: SensorReadingRow): SensorReading {
  return {
    id: row.id,
    plantId: row.plant_id,
    deviceId: row.device_id,
    recordedAt: row.recorded_at,
    temperatureC: row.temperature_c,
    soilMoistureRaw: row.soil_moisture_raw,
    soilMoisturePercent: row.soil_moisture_percent,
    soilMoistureStatus: row.soil_moisture_status as MoistureStatus,
    source: row.source as ReadingSource,
  };
}

export function toDevice(row: DeviceRow): Device {
  return {
    id: row.id,
    plantId: row.plant_id,
    deviceName: row.device_name,
    firmwareVersion: row.firmware_version,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
  };
}

export function toCareEvent(row: CareEventRow): CareEvent {
  return {
    id: row.id,
    plantId: row.plant_id,
    eventType: row.event_type as CareEventType,
    occurredAt: row.occurred_at,
    amountMl: row.amount_ml,
    notes: row.notes,
  };
}

export function toAssessment(row: AssessmentRow): Assessment {
  return {
    id: row.id,
    plantId: row.plant_id,
    createdAt: row.created_at,
    aiModel: row.ai_model,
    assessment: row.assessment,
    recommendedAction: row.recommended_action,
    confidence: row.confidence as Confidence,
    reasons: stringArray(row.reasons),
    limitations: stringArray(row.limitations),
  };
}

export function toOutcome(row: OutcomeRow): InterventionOutcome {
  return {
    id: row.id,
    plantId: row.plant_id,
    careEventId: row.care_event_id,
    observedAt: row.observed_at,
    outcome: row.outcome as InterventionOutcomeKind,
    explanation: row.explanation,
  };
}
