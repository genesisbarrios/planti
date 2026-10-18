-- Planti research schema: selective Tavily research runs, their sources, and
-- the evidence links behind each assessment claim. Written only by server
-- code (service role) after ownership checks; users can read their own.

create table public.research_runs (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants (id) on delete cascade,
  assessment_id uuid references public.plant_assessments (id) on delete set null,
  user_id uuid references auth.users (id) on delete cascade,
  query text not null check (char_length(query) between 1 and 400),
  research_mode text not null check (research_mode in ('search', 'extract', 'research')),
  status text not null check (status in ('pending', 'completed', 'no_reliable_sources', 'failed', 'skipped')),
  -- Why the research policy decided this question needed external evidence.
  reason text,
  result_summary text,
  provider_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(provider_metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index research_runs_plant_created_idx on public.research_runs (plant_id, created_at desc);
create index research_runs_assessment_idx on public.research_runs (assessment_id);
create index research_runs_user_idx on public.research_runs (user_id);
-- Reuse lookups: same plant asking the same normalized question.
create index research_runs_plant_query_idx on public.research_runs (plant_id, lower(query), created_at desc);

create table public.research_sources (
  id uuid primary key default gen_random_uuid(),
  research_run_id uuid not null references public.research_runs (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  url text not null check (url ~* '^https?://' and char_length(url) <= 2048),
  domain text check (char_length(domain) <= 255),
  retrieved_at timestamptz not null default now(),
  -- Only set when the provider reports it; never inferred.
  published_at timestamptz,
  relevance_score double precision check (relevance_score is null or relevance_score between 0 and 1),
  -- Compact excerpts only; full page bodies are not stored.
  excerpt text check (char_length(excerpt) <= 2000),
  evidence_summary text check (char_length(evidence_summary) <= 2000),
  source_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(source_metadata) = 'object')
);

create index research_sources_run_idx on public.research_sources (research_run_id);
create unique index research_sources_run_url_unique on public.research_sources (research_run_id, url);

create table public.assessment_evidence (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.plant_assessments (id) on delete cascade,
  evidence_type text not null check (evidence_type in ('measurement', 'calculation', 'care_history', 'external_source', 'hypothesis')),
  sensor_reading_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(sensor_reading_ids) = 'array'),
  care_event_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(care_event_ids) = 'array'),
  research_source_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(research_source_ids) = 'array'),
  claim text not null check (char_length(claim) between 1 and 1000),
  evidence_summary text check (char_length(evidence_summary) <= 2000),
  created_at timestamptz not null default now()
);

create index assessment_evidence_assessment_idx on public.assessment_evidence (assessment_id);

-- Ownership helpers that traverse to the plant.
create or replace function public.owns_research_run(target_run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.research_runs r
    join public.plants p on p.id = r.plant_id
    where r.id = target_run_id and p.user_id = (select auth.uid())
  );
$$;

create or replace function public.owns_assessment(target_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.plant_assessments a
    join public.plants p on p.id = a.plant_id
    where a.id = target_assessment_id and p.user_id = (select auth.uid())
  );
$$;

revoke all on function public.owns_research_run(uuid), public.owns_assessment(uuid) from public;
grant execute on function public.owns_research_run(uuid), public.owns_assessment(uuid) to authenticated, service_role;

revoke all on public.research_runs, public.research_sources, public.assessment_evidence from anon, authenticated;
-- provider_metadata is internal agent/provider detail and stays server-side.
grant select (id, plant_id, assessment_id, user_id, query, research_mode, status, reason, result_summary, created_at)
  on public.research_runs to authenticated;
grant select (id, research_run_id, title, url, domain, retrieved_at, published_at, relevance_score, excerpt, evidence_summary)
  on public.research_sources to authenticated;
grant select on public.assessment_evidence to authenticated;
grant all on public.research_runs, public.research_sources, public.assessment_evidence to service_role;

alter table public.research_runs enable row level security;
alter table public.research_sources enable row level security;
alter table public.assessment_evidence enable row level security;

create policy "research runs: read for own plants" on public.research_runs
  for select to authenticated using (public.owns_plant(plant_id));
create policy "research sources: read for own runs" on public.research_sources
  for select to authenticated using (public.owns_research_run(research_run_id));
create policy "assessment evidence: read for own assessments" on public.assessment_evidence
  for select to authenticated using (public.owns_assessment(assessment_id));
