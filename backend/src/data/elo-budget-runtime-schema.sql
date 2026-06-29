create table if not exists public.elo_budget_documents (
  id text primary key,
  institution_id text,
  project_id text,
  owner_user_id text,
  title text not null,
  status text not null default 'draft',
  current_version_id text,
  document_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.elo_budget_versions (
  id text primary key,
  budget_id text not null references public.elo_budget_documents(id) on delete cascade,
  version_number integer not null,
  document_data jsonb not null,
  created_by_user_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.elo_budget_events (
  id text primary key,
  budget_id text references public.elo_budget_documents(id) on delete cascade,
  institution_id text,
  user_id text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.elo_generated_documents (
  id text primary key,
  budget_id text not null references public.elo_budget_documents(id) on delete cascade,
  version_id text references public.elo_budget_versions(id) on delete set null,
  document_type text not null,
  status text not null default 'generated',
  file_name text not null,
  html_content text,
  file_path text,
  generated_by_user_id text,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists elo_budget_documents_institution_id_idx
  on public.elo_budget_documents(institution_id);

create index if not exists elo_budget_documents_owner_user_id_idx
  on public.elo_budget_documents(owner_user_id);

create index if not exists elo_budget_versions_budget_id_idx
  on public.elo_budget_versions(budget_id);

create index if not exists elo_budget_events_budget_id_idx
  on public.elo_budget_events(budget_id);

create index if not exists elo_generated_documents_budget_id_idx
  on public.elo_generated_documents(budget_id);
