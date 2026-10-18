-- Planti core schema: plants, devices, readings, care events, assessments and
-- intervention outcomes. Every user-facing table has RLS; access is decided by
-- ownership of the parent plant.
--
-- Write model:
--   * Users (authenticated role) manage their own plants and care events, and
--     may insert simulated/manual readings for their own plants.
--   * Device readings, devices, assessments and outcomes are written only by
--     server code using the service role, after it has verified the device
--     credential or the user's ownership. Browsers can read them, not forge them.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 120),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- plants
-- ---------------------------------------------------------------------------

create table public.plants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  species text check (char_length(species) <= 200),
  location text check (char_length(location) <= 200),
  light_conditions text check (char_length(light_conditions) <= 500),
  pot_notes text check (char_length(pot_notes) <= 1000),
  care_preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(care_preferences) = 'object'),
  planted_at date,
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index plants_user_id_created_at_idx on public.plants (user_id, created_at);

create trigger plants_set_updated_at
  before update on public.plants
  for each row execute function public.set_updated_at();

-- Ownership check used by child-table policies. SECURITY DEFINER so policies
-- on child tables do not recurse through plants' own RLS; it only ever answers
-- for the calling user.
create or replace function public.owns_plant(target_plant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.plants p
    where p.id = target_plant_id and p.user_id = (select auth.uid())
  );
$$;

revoke all on function public.owns_plant(uuid) from public;
grant execute on function public.owns_plant(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- devices
-- ---------------------------------------------------------------------------

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants (id) on delete cascade,
  -- HMAC-SHA256 of the device credential, keyed with DEVICE_INGESTION_SECRET.
  -- The plaintext credential is shown once at provisioning and never stored.
  device_key_hash text not null check (device_key_hash ~ '^[0-9a-f]{64}$'),
  device_name text check (char_length(device_name) <= 120),
  firmware_version text check (char_length(firmware_version) <= 40),
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create index devices_plant_id_idx on public.devices (plant_id);

-- ---------------------------------------------------------------------------
-- sensor_readings
-- ---------------------------------------------------------------------------

create table public.sensor_readings (
  id bigint generated always as identity primary key,
  plant_id uuid not null references public.plants (id) on delete cascade,
  device_id uuid references public.devices (id) on delete set null,
  recorded_at timestamptz not null,
  temperature_c double precision check (temperature_c between -40 and 85),
  -- Null for I2C sensors that do not expose a raw analog value.
  soil_moisture_raw integer check (soil_moisture_raw between 0 and 65535),
  soil_moisture_percent double precision check (soil_moisture_percent between 0 and 100),
  soil_moisture_status text not null default 'unknown'
    check (soil_moisture_status in ('dry', 'adequate', 'wet', 'unknown')),
  source text not null check (source in ('device', 'simulated', 'manual')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  -- Device readings must name their device; other sources must not.
  constraint sensor_readings_device_source check ((source = 'device') = (device_id is not null))
);

create index sensor_readings_plant_recorded_idx on public.sensor_readings (plant_id, recorded_at desc);
create index sensor_readings_device_recorded_idx on public.sensor_readings (device_id, recorded_at desc);
-- Replay / duplicate upload protection: one reading per device per timestamp.
create unique index sensor_readings_device_recorded_unique on public.sensor_readings (device_id, recorded_at)
  where device_id is not null;

-- ---------------------------------------------------------------------------
-- care_events
-- ---------------------------------------------------------------------------

create table public.care_events (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null check (event_type in ('watered', 'fertilized', 'moved', 'repotted', 'other')),
  occurred_at timestamptz not null default now(),
  amount_ml integer check (amount_ml between 0 and 20000),
  notes text check (char_length(notes) <= 1000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index care_events_plant_occurred_idx on public.care_events (plant_id, occurred_at desc);
create index care_events_user_id_idx on public.care_events (user_id);

-- ---------------------------------------------------------------------------
-- plant_assessments
-- ---------------------------------------------------------------------------

create table public.plant_assessments (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants (id) on delete cascade,
  created_at timestamptz not null default now(),
  analysis_window_start timestamptz,
  analysis_window_end timestamptz,
  evidence jsonb not null,
  trend_summary jsonb not null,
  -- Null when the assessment is the deterministic fallback (no model output).
  ai_model text,
  assessment text not null,
  recommended_action text,
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  reasons jsonb not null default '[]'::jsonb check (jsonb_typeof(reasons) = 'array'),
  limitations jsonb not null default '[]'::jsonb check (jsonb_typeof(limitations) = 'array'),
  check (analysis_window_start is null or analysis_window_end is null or analysis_window_start <= analysis_window_end)
);

create index plant_assessments_plant_created_idx on public.plant_assessments (plant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- intervention_outcomes
-- ---------------------------------------------------------------------------

create table public.intervention_outcomes (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants (id) on delete cascade,
  care_event_id uuid references public.care_events (id) on delete set null,
  assessment_id uuid references public.plant_assessments (id) on delete set null,
  observed_at timestamptz not null default now(),
  observation_window_minutes integer check (observation_window_minutes > 0),
  before_summary jsonb not null default '{}'::jsonb,
  after_summary jsonb not null default '{}'::jsonb,
  -- Observed responses, not proof that the intervention caused the change.
  outcome text not null check (
    outcome in ('pending_observation', 'moisture_increase_observed', 'no_measurable_change', 'inconclusive')
  ),
  explanation text,
  created_at timestamptz not null default now()
);

create index intervention_outcomes_plant_observed_idx on public.intervention_outcomes (plant_id, observed_at desc);
-- One evolving outcome record per care event.
create unique index intervention_outcomes_care_event_unique on public.intervention_outcomes (care_event_id)
  where care_event_id is not null;

-- ---------------------------------------------------------------------------
-- Privileges. Explicit grants instead of relying on project defaults; anon
-- gets nothing on private data.
-- ---------------------------------------------------------------------------

revoke all on public.profiles, public.plants, public.devices, public.sensor_readings, public.care_events,
  public.plant_assessments, public.intervention_outcomes from anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.plants to authenticated;
grant select, insert, update, delete on public.care_events to authenticated;
grant select, insert on public.sensor_readings to authenticated;
grant select on public.plant_assessments, public.intervention_outcomes to authenticated;
-- Devices: readable without the credential hash; removable by the owner.
-- Creation and protected fields (hash, last_seen_at, firmware) are server-only.
grant select (id, plant_id, device_name, firmware_version, last_seen_at, created_at) on public.devices to authenticated;
grant delete on public.devices to authenticated;

grant all on public.profiles, public.plants, public.devices, public.sensor_readings, public.care_events,
  public.plant_assessments, public.intervention_outcomes to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.plants enable row level security;
alter table public.devices enable row level security;
alter table public.sensor_readings enable row level security;
alter table public.care_events enable row level security;
alter table public.plant_assessments enable row level security;
alter table public.intervention_outcomes enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "plants: read own" on public.plants
  for select to authenticated using (user_id = (select auth.uid()));
create policy "plants: insert own" on public.plants
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "plants: update own" on public.plants
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "plants: delete own" on public.plants
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "devices: read for own plants" on public.devices
  for select to authenticated using (public.owns_plant(plant_id));
create policy "devices: delete for own plants" on public.devices
  for delete to authenticated using (public.owns_plant(plant_id));

create policy "readings: read for own plants" on public.sensor_readings
  for select to authenticated using (public.owns_plant(plant_id));
-- Browsers may add simulated or manual readings for their own plants, never
-- device readings: those arrive only through verified telemetry ingestion.
create policy "readings: insert simulated or manual for own plants" on public.sensor_readings
  for insert to authenticated
  with check (public.owns_plant(plant_id) and source in ('simulated', 'manual') and device_id is null);

create policy "care events: read for own plants" on public.care_events
  for select to authenticated using (public.owns_plant(plant_id));
create policy "care events: insert own" on public.care_events
  for insert to authenticated with check (user_id = (select auth.uid()) and public.owns_plant(plant_id));
create policy "care events: update own" on public.care_events
  for update to authenticated
  using (user_id = (select auth.uid()) and public.owns_plant(plant_id))
  with check (user_id = (select auth.uid()) and public.owns_plant(plant_id));
create policy "care events: delete own" on public.care_events
  for delete to authenticated using (user_id = (select auth.uid()) and public.owns_plant(plant_id));

create policy "assessments: read for own plants" on public.plant_assessments
  for select to authenticated using (public.owns_plant(plant_id));

create policy "outcomes: read for own plants" on public.intervention_outcomes
  for select to authenticated using (public.owns_plant(plant_id));
