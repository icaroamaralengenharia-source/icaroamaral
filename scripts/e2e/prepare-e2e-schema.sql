-- ELO E2E TEST schema preparation.
-- Execute only in the isolated Supabase project reserved for E2E tests.
-- This file consolidates existing repository schemas without DROP/TRUNCATE.

create extension if not exists pgcrypto;

create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  document text,
  created_at timestamptz not null default now()
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null,
  type text,
  created_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  company_id text unique,
  name text not null,
  document text,
  phone text,
  responsible_name text,
  status text not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  institution_id uuid references public.institutions(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'leitura' check (role in ('admin','administrador','gestor','almoxarife','estoquista','vendedor','funcionario','operador','leitura')),
  status text not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.profiles
  add column if not exists institution_id uuid references public.institutions(id) on delete cascade,
  add column if not exists unit_id uuid references public.units(id) on delete set null,
  add column if not exists company_id uuid references public.companies(id) on delete cascade,
  add column if not exists status text not null default 'ativo';

create table if not exists public.obrareport_clients (
  id text primary key,
  institution_id text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.obrareport_projects (
  id text primary key,
  institution_id text not null,
  client_id text references public.obrareport_clients(id),
  name text not null,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.obrareport_technical_reports (
  id text primary key,
  institution_id text not null,
  project_id text references public.obrareport_projects(id),
  client_id text references public.obrareport_clients(id),
  title text not null,
  status text not null default 'draft',
  report_data_json jsonb not null default '{}'::jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.obrareport_report_versions (
  id text primary key,
  report_id text not null references public.obrareport_technical_reports(id),
  institution_id text not null,
  version_number integer not null,
  report_data_json jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  unique (report_id, version_number)
);

create table if not exists public.obrareport_report_events (
  id text primary key,
  report_id text not null references public.obrareport_technical_reports(id),
  institution_id text not null,
  event_type text not null,
  user_id text,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.obrareport_rdos (
  id text primary key,
  institution_id text not null,
  project_id text references public.obrareport_projects(id),
  client_id text references public.obrareport_clients(id),
  title text not null,
  rdo_date date,
  status text not null default 'draft',
  rdo_data_json jsonb not null default '{}'::jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.obrareport_rdo_versions (
  id text primary key,
  rdo_id text not null references public.obrareport_rdos(id),
  institution_id text not null,
  version_number integer not null,
  rdo_data_json jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  unique (rdo_id, version_number)
);

create table if not exists public.obrareport_rdo_events (
  id text primary key,
  rdo_id text not null references public.obrareport_rdos(id),
  institution_id text not null,
  event_type text not null,
  user_id text,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.obrareport_generated_documents (
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

create table if not exists public.obrareport_document_files (
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

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  sku text,
  category text,
  unit text not null default 'un',
  current_stock numeric not null default 0,
  min_stock numeric not null default 0,
  cost_price numeric not null default 0,
  sale_price numeric not null default 0,
  supplier text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  type text not null check (type in ('entrada','saida')),
  quantity numeric not null check (quantity > 0),
  unit_cost numeric not null default 0,
  total numeric not null default 0,
  reason text,
  supplier text,
  destination text,
  responsible text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  source text not null default 'csv',
  file_name text,
  status text not null default 'concluido',
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  invalid_rows integer not null default 0,
  imported_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_full_items (
  id uuid primary key default gen_random_uuid(),
  institution_id text not null,
  name text not null,
  unit text,
  category text,
  min_quantity numeric default 0,
  current_quantity numeric default 0,
  location text,
  notes text,
  is_active boolean default true,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint stock_full_items_min_quantity_non_negative check (min_quantity >= 0),
  constraint stock_full_items_current_quantity_non_negative check (current_quantity >= 0)
);

create table if not exists public.stock_full_entries (
  id uuid primary key default gen_random_uuid(),
  institution_id text not null,
  offline_uuid text,
  operation_id text,
  device_id text,
  sync_status text default 'synced',
  source text default 'online',
  synced_at timestamptz,
  item_id uuid not null references public.stock_full_items(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  unit_cost numeric,
  supplier text,
  invoice_number text,
  notes text,
  created_by uuid,
  created_at timestamptz default now()
);

create table if not exists public.stock_full_exits (
  id uuid primary key default gen_random_uuid(),
  institution_id text not null,
  offline_uuid text,
  operation_id text,
  device_id text,
  sync_status text default 'synced',
  source text default 'online',
  synced_at timestamptz,
  item_id uuid not null references public.stock_full_items(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  destination text,
  responsible text,
  notes text,
  created_by uuid,
  created_at timestamptz default now()
);

create table if not exists public.stock_full_audit_log (
  id uuid primary key default gen_random_uuid(),
  institution_id text not null,
  action text not null,
  entity_type text,
  entity_id uuid,
  product_id uuid,
  before_data jsonb,
  after_data jsonb,
  device_id text,
  offline_uuid text,
  operation_id text,
  source text default 'online',
  ip_address text,
  description text,
  created_by uuid,
  created_at timestamptz default now()
);

create table if not exists public.elo_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  anonymous_id text,
  institution_id uuid,
  company_id uuid,
  project_id uuid,
  title text not null default 'Nova conversa',
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.elo_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.elo_conversations(id) on delete cascade,
  owner_user_id uuid not null,
  anonymous_id text,
  institution_id uuid,
  company_id uuid,
  project_id uuid,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.elo_memories (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  anonymous_id text,
  institution_id uuid,
  company_id uuid,
  project_id uuid,
  conversation_id uuid references public.elo_conversations(id) on delete set null,
  category text not null default 'preference',
  memory_key text not null default 'geral',
  memory_value text not null,
  confidence numeric not null default 0.8 check (confidence >= 0 and confidence <= 1),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where auth_user_id = auth.uid() and status = 'ativo' limit 1;
$$;

create index if not exists idx_units_institution_id on public.units(institution_id);
create index if not exists idx_profiles_institution_id on public.profiles(institution_id);
create index if not exists idx_profiles_unit_id on public.profiles(unit_id);
create index if not exists idx_profiles_company_id on public.profiles(company_id);
create index if not exists idx_profiles_auth_user_id on public.profiles(auth_user_id);
create index if not exists idx_obrareport_clients_institution on public.obrareport_clients(institution_id);
create index if not exists idx_obrareport_projects_institution on public.obrareport_projects(institution_id);
create index if not exists idx_obrareport_reports_institution on public.obrareport_technical_reports(institution_id, updated_at desc);
create index if not exists idx_obrareport_report_events_report on public.obrareport_report_events(report_id, created_at asc);
create index if not exists idx_obrareport_rdos_institution on public.obrareport_rdos(institution_id, updated_at desc);
create index if not exists idx_obrareport_rdo_events_rdo on public.obrareport_rdo_events(rdo_id, created_at asc);
create index if not exists idx_obrareport_documents_source on public.obrareport_generated_documents(source_type, source_id);
create index if not exists elo_budget_documents_institution_id_idx on public.elo_budget_documents(institution_id);
create index if not exists elo_budget_documents_owner_user_id_idx on public.elo_budget_documents(owner_user_id);
create index if not exists elo_budget_versions_budget_id_idx on public.elo_budget_versions(budget_id);
create index if not exists elo_budget_events_budget_id_idx on public.elo_budget_events(budget_id);
create index if not exists elo_generated_documents_budget_id_idx on public.elo_generated_documents(budget_id);
create index if not exists products_company_id_idx on public.products(company_id);
create index if not exists products_company_sku_idx on public.products(company_id, sku);
create index if not exists stock_movements_company_id_idx on public.stock_movements(company_id);
create index if not exists stock_movements_product_id_idx on public.stock_movements(product_id);
create index if not exists imports_company_id_idx on public.imports(company_id);
create index if not exists audit_logs_company_id_idx on public.audit_logs(company_id);
create index if not exists stock_full_items_institution_id_idx on public.stock_full_items(institution_id);
create index if not exists stock_full_items_is_active_idx on public.stock_full_items(is_active);
create index if not exists stock_full_entries_institution_id_idx on public.stock_full_entries(institution_id);
create index if not exists stock_full_entries_item_id_idx on public.stock_full_entries(item_id);
create unique index if not exists stock_full_entries_offline_uuid_idx on public.stock_full_entries(institution_id, offline_uuid) where offline_uuid is not null;
create index if not exists stock_full_exits_institution_id_idx on public.stock_full_exits(institution_id);
create index if not exists stock_full_exits_item_id_idx on public.stock_full_exits(item_id);
create unique index if not exists stock_full_exits_offline_uuid_idx on public.stock_full_exits(institution_id, offline_uuid) where offline_uuid is not null;
create index if not exists stock_full_audit_log_institution_id_idx on public.stock_full_audit_log(institution_id);
create index if not exists stock_full_audit_log_product_id_idx on public.stock_full_audit_log(product_id);
create index if not exists stock_full_audit_log_created_at_idx on public.stock_full_audit_log(created_at desc);
create index if not exists elo_conversations_owner_user_id_idx on public.elo_conversations(owner_user_id);
create index if not exists elo_conversations_institution_id_idx on public.elo_conversations(institution_id);
create index if not exists elo_conversations_project_id_idx on public.elo_conversations(project_id);
create index if not exists elo_conversations_anonymous_id_idx on public.elo_conversations(anonymous_id) where anonymous_id is not null;
create index if not exists elo_messages_conversation_id_idx on public.elo_messages(conversation_id);
create index if not exists elo_messages_owner_user_id_idx on public.elo_messages(owner_user_id);
create index if not exists elo_memories_owner_user_id_idx on public.elo_memories(owner_user_id);
create index if not exists elo_memories_conversation_id_idx on public.elo_memories(conversation_id);
create index if not exists elo_memories_owner_category_key_idx on public.elo_memories(owner_user_id, category, memory_key) where is_active = true;
create index if not exists elo_memories_anonymous_id_idx on public.elo_memories(anonymous_id) where anonymous_id is not null;

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;
alter table public.imports enable row level security;
alter table public.audit_logs enable row level security;
alter table public.elo_conversations enable row level security;
alter table public.elo_conversations force row level security;
alter table public.elo_messages enable row level security;
alter table public.elo_messages force row level security;
alter table public.elo_memories enable row level security;
alter table public.elo_memories force row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'companies' and policyname = 'companies_same_company_select') then
    create policy companies_same_company_select on public.companies for select using (id = public.current_company_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_same_company_select') then
    create policy profiles_same_company_select on public.profiles for select using (company_id = public.current_company_id() or auth_user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_self_update') then
    create policy profiles_self_update on public.profiles for update using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'products' and policyname = 'products_company_all') then
    create policy products_company_all on public.products for all using (company_id = public.current_company_id()) with check (company_id = public.current_company_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'stock_movements' and policyname = 'stock_movements_company_all') then
    create policy stock_movements_company_all on public.stock_movements for all using (company_id = public.current_company_id()) with check (company_id = public.current_company_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'imports' and policyname = 'imports_company_all') then
    create policy imports_company_all on public.imports for all using (company_id = public.current_company_id()) with check (company_id = public.current_company_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'audit_logs' and policyname = 'audit_logs_company_all') then
    create policy audit_logs_company_all on public.audit_logs for all using (company_id = public.current_company_id()) with check (company_id = public.current_company_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'elo_conversations' and policyname = 'elo_conversations_owner_select') then
    create policy elo_conversations_owner_select on public.elo_conversations for select using (owner_user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'elo_conversations' and policyname = 'elo_conversations_owner_insert') then
    create policy elo_conversations_owner_insert on public.elo_conversations for insert with check (owner_user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'elo_conversations' and policyname = 'elo_conversations_owner_update') then
    create policy elo_conversations_owner_update on public.elo_conversations for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'elo_conversations' and policyname = 'elo_conversations_owner_delete') then
    create policy elo_conversations_owner_delete on public.elo_conversations for delete using (owner_user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'elo_messages' and policyname = 'elo_messages_owner_select') then
    create policy elo_messages_owner_select on public.elo_messages for select using (owner_user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'elo_messages' and policyname = 'elo_messages_owner_insert') then
    create policy elo_messages_owner_insert on public.elo_messages for insert with check (owner_user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'elo_messages' and policyname = 'elo_messages_owner_update') then
    create policy elo_messages_owner_update on public.elo_messages for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'elo_messages' and policyname = 'elo_messages_owner_delete') then
    create policy elo_messages_owner_delete on public.elo_messages for delete using (owner_user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'elo_memories' and policyname = 'elo_memories_owner_select') then
    create policy elo_memories_owner_select on public.elo_memories for select using (owner_user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'elo_memories' and policyname = 'elo_memories_owner_insert') then
    create policy elo_memories_owner_insert on public.elo_memories for insert with check (owner_user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'elo_memories' and policyname = 'elo_memories_owner_update') then
    create policy elo_memories_owner_update on public.elo_memories for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'elo_memories' and policyname = 'elo_memories_owner_delete') then
    create policy elo_memories_owner_delete on public.elo_memories for delete using (owner_user_id = auth.uid());
  end if;
end $$;

-- ELO Sentinel isolated schema
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
  constraint elo_sentinel_events_type_chk check (length(btrim(event_type)) > 0)
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



alter table public.elo_sentinel_events
  add column if not exists source_module text,
  add column if not exists source_entity_type text,
  add column if not exists source_entity_id text,
  add column if not exists severity text,
  add column if not exists status text,
  add column if not exists idempotency_key text;

do $
begin
  alter table public.elo_sentinel_events drop constraint if exists elo_sentinel_events_type_chk;
  alter table public.elo_sentinel_events
    add constraint elo_sentinel_events_type_chk check (length(btrim(event_type)) > 0);
exception
  when duplicate_object then null;
end $;

create index if not exists elo_sentinel_events_institution_id_idx
  on public.elo_sentinel_events(institution_id);

create index if not exists elo_sentinel_events_company_project_idx
  on public.elo_sentinel_events(company_id, project_id, occurred_at desc);

create index if not exists elo_sentinel_events_evidence_id_idx
  on public.elo_sentinel_events(evidence_id);

create index if not exists elo_sentinel_events_project_type_idx
  on public.elo_sentinel_events(institution_id, company_id, project_id, event_type, occurred_at desc);



create index if not exists elo_sentinel_events_project_occurred_created_idx
  on public.elo_sentinel_events(institution_id, company_id, project_id, occurred_at desc, created_at desc);

create index if not exists elo_sentinel_events_source_module_idx
  on public.elo_sentinel_events(institution_id, company_id, project_id, source_module, occurred_at desc);

create index if not exists elo_sentinel_events_source_entity_type_idx
  on public.elo_sentinel_events(institution_id, company_id, project_id, source_entity_type, occurred_at desc);

create index if not exists elo_sentinel_events_source_entity_id_idx
  on public.elo_sentinel_events(institution_id, company_id, project_id, source_entity_id);

create index if not exists elo_sentinel_events_severity_idx
  on public.elo_sentinel_events(institution_id, company_id, project_id, severity, occurred_at desc);

create index if not exists elo_sentinel_events_status_idx
  on public.elo_sentinel_events(institution_id, company_id, project_id, status, occurred_at desc);

create unique index if not exists elo_sentinel_events_idempotency_idx
  on public.elo_sentinel_events(institution_id, company_id, project_id, idempotency_key)
  where idempotency_key is not null;

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
