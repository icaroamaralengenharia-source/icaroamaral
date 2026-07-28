create extension if not exists pgcrypto;

create table if not exists public.elo_sentinel_evidences (
  id uuid primary key default gen_random_uuid(),
  institution_id text not null,
  company_id text not null,
  project_id text not null,
  created_by text,
  evidence_type text not null,
  source text not null default 'manual',
  title text not null,
  description text,
  storage_path text,
  file_hash text,
  mime_type text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'registered',
  occurred_at timestamptz not null default now(),
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint elo_sentinel_evidences_type_chk check (evidence_type in ('text', 'photo', 'document', 'note')),
  constraint elo_sentinel_evidences_source_chk check (source in ('manual', 'upload', 'system')),
  constraint elo_sentinel_evidences_status_chk check (status in ('draft', 'registered'))
);

create table if not exists public.elo_sentinel_events (
  id uuid primary key default gen_random_uuid(),
  institution_id text not null,
  company_id text not null,
  project_id text not null,
  evidence_id uuid,
  event_type text not null,
  title text not null,
  description text,
  occurred_at timestamptz not null default now(),
  created_by text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint elo_sentinel_events_type_chk check (event_type in ('evidence_created', 'evidence_registered', 'manual_note'))
);

alter table public.elo_sentinel_evidences
  add column if not exists occurred_at timestamptz not null default now();

alter table public.elo_sentinel_evidences
  add column if not exists idempotency_key text;

create index if not exists elo_sentinel_evidences_institution_id_idx
  on public.elo_sentinel_evidences(institution_id);

create index if not exists elo_sentinel_evidences_company_project_idx
  on public.elo_sentinel_evidences(company_id, project_id, created_at desc);

create index if not exists elo_sentinel_evidences_project_created_idx
  on public.elo_sentinel_evidences(project_id, created_at desc);

create index if not exists elo_sentinel_evidences_project_occurred_idx
  on public.elo_sentinel_evidences(institution_id, company_id, project_id, occurred_at desc);

create index if not exists elo_sentinel_evidences_project_type_idx
  on public.elo_sentinel_evidences(institution_id, company_id, project_id, evidence_type, occurred_at desc);

create unique index if not exists elo_sentinel_evidences_idempotency_idx
  on public.elo_sentinel_evidences(institution_id, company_id, project_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists elo_sentinel_events_institution_id_idx
  on public.elo_sentinel_events(institution_id);

create index if not exists elo_sentinel_events_company_project_idx
  on public.elo_sentinel_events(company_id, project_id, occurred_at desc);

create index if not exists elo_sentinel_events_evidence_id_idx
  on public.elo_sentinel_events(evidence_id);

create index if not exists elo_sentinel_events_project_type_idx
  on public.elo_sentinel_events(institution_id, company_id, project_id, event_type, occurred_at desc);

alter table public.elo_sentinel_evidences enable row level security;
alter table public.elo_sentinel_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'elo_sentinel_evidences'
      and policyname = 'elo_sentinel_evidences_owner_all'
  ) then
    create policy elo_sentinel_evidences_owner_all
      on public.elo_sentinel_evidences
      for all
      using (created_by = auth.uid()::text)
      with check (created_by = auth.uid()::text);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'elo_sentinel_events'
      and policyname = 'elo_sentinel_events_owner_all'
  ) then
    create policy elo_sentinel_events_owner_all
      on public.elo_sentinel_events
      for all
      using (created_by = auth.uid()::text)
      with check (created_by = auth.uid()::text);
  end if;
end $$;