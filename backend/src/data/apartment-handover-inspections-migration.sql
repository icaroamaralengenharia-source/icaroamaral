-- Step 06 local preparation only. Do not apply to a live Supabase project without review.

create table if not exists obrareport_apartment_handover_inspections (
  id text primary key,
  institution_id text not null,
  project_id text,
  client_id text,
  title text not null,
  unit text,
  inspection_date date,
  status text not null default 'draft' check (status in ('draft', 'completed', 'final_pdf_generated', 'archived')),
  source_type text not null default 'apartment_handover_inspection' check (source_type = 'apartment_handover_inspection'),
  source_id text,
  idempotency_key text,
  inspection_data_json jsonb not null default '{}'::jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  reopened_at timestamptz,
  unique (institution_id, idempotency_key)
);

create table if not exists obrareport_apartment_handover_inspection_versions (
  id text primary key,
  inspection_id text not null references obrareport_apartment_handover_inspections(id) on delete cascade,
  institution_id text not null,
  version_number integer not null,
  inspection_data_json jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  unique (inspection_id, version_number)
);

create table if not exists obrareport_apartment_handover_inspection_events (
  id text primary key,
  inspection_id text not null references obrareport_apartment_handover_inspections(id) on delete cascade,
  institution_id text not null,
  event_type text not null,
  user_id text,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_obrareport_ahi_institution
  on obrareport_apartment_handover_inspections(institution_id, updated_at desc);
create index if not exists idx_obrareport_ahi_project
  on obrareport_apartment_handover_inspections(institution_id, project_id, updated_at desc);
create index if not exists idx_obrareport_ahi_versions
  on obrareport_apartment_handover_inspection_versions(inspection_id, version_number desc);
create index if not exists idx_obrareport_ahi_events
  on obrareport_apartment_handover_inspection_events(inspection_id, created_at asc);

alter table if exists obrareport_generated_documents
  drop constraint if exists obrareport_generated_documents_source_type_check;
alter table if exists obrareport_generated_documents
  add constraint obrareport_generated_documents_source_type_check
  check (source_type in ('technical_report', 'rdo', 'apartment_handover_inspection'));

alter table obrareport_apartment_handover_inspections enable row level security;
alter table obrareport_apartment_handover_inspection_versions enable row level security;
alter table obrareport_apartment_handover_inspection_events enable row level security;

drop policy if exists obrareport_ahi_same_institution_select on obrareport_apartment_handover_inspections;
create policy obrareport_ahi_same_institution_select
  on obrareport_apartment_handover_inspections for select to authenticated
  using (exists (select 1 from public.profiles p where p.auth_user_id = auth.uid() and p.institution_id::text = institution_id));

drop policy if exists obrareport_ahi_same_institution_write on obrareport_apartment_handover_inspections;
create policy obrareport_ahi_same_institution_write
  on obrareport_apartment_handover_inspections for all to service_role
  using (true) with check (true);

drop policy if exists obrareport_ahi_versions_same_institution_select on obrareport_apartment_handover_inspection_versions;
create policy obrareport_ahi_versions_same_institution_select
  on obrareport_apartment_handover_inspection_versions for select to authenticated
  using (exists (select 1 from public.profiles p where p.auth_user_id = auth.uid() and p.institution_id::text = institution_id));

drop policy if exists obrareport_ahi_versions_service_write on obrareport_apartment_handover_inspection_versions;
create policy obrareport_ahi_versions_service_write
  on obrareport_apartment_handover_inspection_versions for all to service_role
  using (true) with check (true);

drop policy if exists obrareport_ahi_events_same_institution_select on obrareport_apartment_handover_inspection_events;
create policy obrareport_ahi_events_same_institution_select
  on obrareport_apartment_handover_inspection_events for select to authenticated
  using (exists (select 1 from public.profiles p where p.auth_user_id = auth.uid() and p.institution_id::text = institution_id));

drop policy if exists obrareport_ahi_events_service_write on obrareport_apartment_handover_inspection_events;
create policy obrareport_ahi_events_service_write
  on obrareport_apartment_handover_inspection_events for all to service_role
  using (true) with check (true);
