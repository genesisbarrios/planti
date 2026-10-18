import { z } from "zod";

/** Empty form fields become null so optional columns stay null, not "". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

/**
 * Care preferences are what the user tells Planti, not facts Planti assumes
 * about a species. Free text per field keeps them editable and honest.
 */
export const carePreferencesSchema = z
  .object({
    watering: optionalText(500),
    light: optionalText(500),
    other: optionalText(1000),
  })
  .transform((prefs) => Object.fromEntries(Object.entries(prefs).filter(([, v]) => v !== null)) as Record<string, string>);

export const plantInputSchema = z.object({
  name: z.string().trim().min(1, "Give the plant a name").max(120, "Keep the name under 120 characters"),
  species: optionalText(200),
  location: optionalText(200),
  lightConditions: optionalText(500),
  potNotes: optionalText(1000),
  notes: optionalText(2000),
  plantedAt: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), "Use a valid date")
    .refine((v) => v === null || Date.parse(v) <= Date.now(), "Planting date can't be in the future"),
  carePreferences: carePreferencesSchema,
});

export type PlantInput = z.infer<typeof plantInputSchema>;

export function plantInputFromForm(formData: FormData) {
  const get = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : undefined;
  };
  return plantInputSchema.safeParse({
    name: get("name") ?? "",
    species: get("species"),
    location: get("location"),
    lightConditions: get("lightConditions"),
    potNotes: get("potNotes"),
    notes: get("notes"),
    plantedAt: get("plantedAt"),
    carePreferences: {
      watering: get("careWatering"),
      light: get("careLight"),
      other: get("careOther"),
    },
  });
}

export const uuidSchema = z.uuid();
