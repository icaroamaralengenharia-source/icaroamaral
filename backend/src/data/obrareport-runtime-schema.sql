create table if not exists obrareport_clients (
  id text primary key,
  institution_id text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists obrareport_projects (
  id text primary key,
  institution_id text not null,
  client_id text references obrareport_clients(id),
  name text not null,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists obrareport_technical_reports (
  id text primary key,
  institution_id text not null,
  project_id text references obrareport_projects(id),
  client_id text references obrareport_clients(id),
  title text not null,
  status text not null default 'draft',
  report_data_json jsonb not null default '{}'::jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists obrareport_report_versions (
  id text primary key,
  report_id text not null references obrareport_technical_reports(id),
  institution_id text not null,
  version_number integer not null,
  report_data_json jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  unique (report_id, version_number)
);

create table if not exists obrareport_report_events (
  id text primary key,
  report_id text not null references obrareport_technical_reports(id),
  institution_id text not null,
  event_type text not null,
  user_id text,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists obrareport_rdos (
  id text primary key,
  institution_id text not null,
  project_id text references obrareport_projects(id),
  client_id text references obrareport_clients(id),
  title text not null,
  rdo_date date,
  status text not null default 'draft',
  rdo_data_json jsonb not null default '{}'::jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists obrareport_rdo_versions (
  id text primary key,
  rdo_id text not null references obrareport_rdos(id),
  institution_id text not null,
  version_number integer not null,
  rdo_data_json jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  unique (rdo_id, version_number)
);

create table if not exists obrareport_rdo_events (
  id text primary key,
  rdo_id text not null references obrareport_rdos(id),
  institution_id text not null,
  event_type text not null,
  user_id text,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists obrareport_generated_documents (
  id text primary key,
  institution_id text not null,
  source_type text not null check (source_type in ('technical_report', 'rdo')),
  source_id text not null,
  document_type text not null,
  status text not null default 'generated',
  file_id text,
  file_url text,
  hash text,
  metadata_json jsonb not null default '{}'::jsonb,
  generated_by text,
  generated_at timestamptz not null default now()
);

create table if not exists obrareport_document_files (
  id text primary key,
  institution_id text not null,
  filename text not null,
  mime_type text not null,
  storage_path text,
  public_url text,
  size_bytes integer,
  hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_obrareport_clients_institution on obrareport_clients(institution_id);
create index if not exists idx_obrareport_projects_institution on obrareport_projects(institution_id);
create index if not exists idx_obrareport_reports_institution on obrareport_technical_reports(institution_id, updated_at desc);
create index if not exists idx_obrareport_report_events_report on obrareport_report_events(report_id, created_at asc);
create index if not exists idx_obrareport_rdos_institution on obrareport_rdos(institution_id, updated_at desc);
create index if not exists idx_obrareport_rdo_events_rdo on obrareport_rdo_events(rdo_id, created_at asc);
create index if not exists idx_obrareport_documents_source on obrareport_generated_documents(source_type, source_id);