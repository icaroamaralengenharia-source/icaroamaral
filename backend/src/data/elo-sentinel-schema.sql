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
  constraint elo_sentinel_events_type_chk check (event_type in ('evidence_created', 'evidence_registered', 'manual_note', 'pending_item_created', 'pending_item_updated', 'pending_item_status_changed', 'pending_item_assigned', 'pending_item_due_date_changed', 'pending_item_evidence_linked', 'pending_item_validated', 'pending_item_validation_rejected'))
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
create table if not exists public.elo_sentinel_pending_items (
  id uuid primary key default gen_random_uuid(),
  institution_id text not null,
  company_id text not null,
  project_id text not null,
  source_evidence_id uuid,
  title text not null,
  description text,
  category text,
  priority text not null default 'medium',
  severity text not null default 'minor',
  status text not null default 'suggested',
  responsible_user_id text,
  due_at timestamptz,
  suggested_by text,
  created_by text,
  validated_by text,
  validated_at timestamptz,
  validation_status text not null default 'pending',
  resolution_notes text,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint elo_sentinel_pending_status_chk check (status in ('suggested', 'open', 'in_progress', 'awaiting_validation', 'resolved', 'rejected', 'cancelled')),
  constraint elo_sentinel_pending_validation_chk check (validation_status in ('pending', 'approved', 'rejected')),
  constraint elo_sentinel_pending_priority_chk check (priority in ('low', 'medium', 'high', 'critical')),
  constraint elo_sentinel_pending_severity_chk check (severity in ('informational', 'minor', 'major', 'critical'))
);

create table if not exists public.elo_sentinel_pending_item_evidences (
  id uuid primary key default gen_random_uuid(),
  institution_id text not null,
  company_id text not null,
  project_id text not null,
  pending_item_id uuid not null,
  evidence_id uuid not null,
  relation_type text not null,
  created_by text,
  created_at timestamptz not null default now(),
  constraint elo_sentinel_pending_evidence_relation_chk check (relation_type in ('source', 'correction', 'validation', 'supporting'))
);

create index if not exists elo_sentinel_pending_items_scope_idx
  on public.elo_sentinel_pending_items(institution_id, company_id, project_id, created_at desc);

create index if not exists elo_sentinel_pending_items_status_idx
  on public.elo_sentinel_pending_items(institution_id, company_id, project_id, status, created_at desc);

create index if not exists elo_sentinel_pending_items_priority_idx
  on public.elo_sentinel_pending_items(institution_id, company_id, project_id, priority, due_at);

create index if not exists elo_sentinel_pending_items_due_at_idx
  on public.elo_sentinel_pending_items(institution_id, company_id, project_id, due_at);

create unique index if not exists elo_sentinel_pending_items_idempotency_idx
  on public.elo_sentinel_pending_items(institution_id, company_id, project_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists elo_sentinel_pending_links_pending_idx
  on public.elo_sentinel_pending_item_evidences(institution_id, company_id, project_id, pending_item_id);

create index if not exists elo_sentinel_pending_links_evidence_idx
  on public.elo_sentinel_pending_item_evidences(institution_id, company_id, project_id, evidence_id);

create unique index if not exists elo_sentinel_pending_links_unique_idx
  on public.elo_sentinel_pending_item_evidences(institution_id, company_id, project_id, pending_item_id, evidence_id, relation_type);

alter table public.elo_sentinel_pending_items enable row level security;
alter table public.elo_sentinel_pending_item_evidences enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'elo_sentinel_pending_items'
      and policyname = 'elo_sentinel_pending_items_owner_all'
  ) then
    create policy elo_sentinel_pending_items_owner_all
      on public.elo_sentinel_pending_items
      for all
      using (created_by = auth.uid()::text)
      with check (created_by = auth.uid()::text);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'elo_sentinel_pending_item_evidences'
      and policyname = 'elo_sentinel_pending_item_evidences_owner_all'
  ) then
    create policy elo_sentinel_pending_item_evidences_owner_all
      on public.elo_sentinel_pending_item_evidences
      for all
      using (created_by = auth.uid()::text)
      with check (created_by = auth.uid()::text);
  end if;
end $$;
