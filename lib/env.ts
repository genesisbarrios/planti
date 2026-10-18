import "server-only";

/**
 * Server-side view of Planti's configuration. Values are read lazily so a
 * missing integration degrades one feature instead of crashing the app, and
 * status helpers only ever report variable *names*, never values.
 */

export type Integration = "supabase" | "supabaseAdmin" | "nebius" | "tavily" | "deviceIngestion";

const REQUIRED: Record<Integration, readonly string[]> = {
  supabase: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
  supabaseAdmin: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  nebius: ["NEBIUS_API_KEY", "NEBIUS_BASE_URL", "NEBIUS_MODEL"],
  tavily: ["TAVILY_API_KEY"],
  deviceIngestion: ["DEVICE_INGESTION_SECRET", "SUPABASE_SERVICE_ROLE_KEY"],
};

function read(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function missingEnv(integration: Integration): string[] {
  return REQUIRED[integration].filter((name) => !read(name));
}

export function isConfigured(integration: Integration): boolean {
  return missingEnv(integration).length === 0;
}

export type IntegrationStatus = {
  integration: Integration;
  configured: boolean;
  missing: string[];
};

export function integrationStatuses(): IntegrationStatus[] {
  return (Object.keys(REQUIRED) as Integration[]).map((integration) => {
    const missing = missingEnv(integration);
    return { integration, configured: missing.length === 0, missing };
  });
}

function requireEnv(name: string): string {
  const value = read(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function supabaseEnv() {
  return {
    url: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey: requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  };
}

export function supabaseAdminEnv() {
  return {
    url: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function nebiusEnv() {
  return {
    apiKey: requireEnv("NEBIUS_API_KEY"),
    baseUrl: requireEnv("NEBIUS_BASE_URL"),
    model: requireEnv("NEBIUS_MODEL"),
  };
}

export function tavilyEnv() {
  return {
    apiKey: requireEnv("TAVILY_API_KEY"),
    baseUrl: read("TAVILY_BASE_URL") ?? "https://api.tavily.com",
  };
}

export function deviceIngestionSecret(): string {
  return requireEnv("DEVICE_INGESTION_SECRET");
}

/** Minutes since the last reading after which a device is no longer "online". */
export function deviceOnlineThresholdMinutes(): number {
  const parsed = Number(read("DEVICE_ONLINE_THRESHOLD_MINUTES"));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
}
