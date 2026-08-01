-- Municipal demo schema bundle.
-- Manual package only. Do not execute against E2E or production.
-- This bundle is additive and idempotent.

-- BEGIN MODULE: municipal-admin-schema.sql
create extension if not exists pgcrypto;

create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  document text,
  city text,
  state text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid
);

alter table public.institutions add column if not exists document text;
alter table public.institutions add column if not exists city text;
alter table public.institutions add column if not exists state text;
alter table public.institutions add column if not exists status text not null default 'active';
alter table public.institutions add column if not exists created_by uuid;

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null,
  code text,
  address text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

alter table public.units add column if not exists code text;
alter table public.units add column if not exists address text;
alter table public.units add column if not exists status text not null default 'active';

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  institution_id uuid references public.institutions(id) on delete cascade,
  company_id uuid,
  unit_id uuid references public.units(id) on delete set null,
  name text not null,
  email text not null,
  role text not null default 'leitura',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists institution_id uuid references public.institutions(id) on delete cascade;
alter table public.profiles add column if not exists unit_id uuid references public.units(id) on delete set null;
alter table public.profiles add column if not exists status text not null default 'active';

create table if not exists public.municipal_admin_invites (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  email text not null,
  role text not null check (role in ('municipal_admin','gestor','almoxarife','funcionario','leitura')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  invited_by uuid,
  status text not null default 'pending' check (status in ('pending','accepted','cancelled','expired')),
  created_at timestamptz not null default now()
);

create table if not exists public.municipal_admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  institution_id uuid references public.institutions(id) on delete cascade,
  target_type text not null,
  target_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists municipal_units_institution_idx on public.units(institution_id);
create index if not exists municipal_profiles_institution_idx on public.profiles(institution_id);
create index if not exists municipal_profiles_auth_user_idx on public.profiles(auth_user_id);
create index if not exists municipal_profiles_unit_idx on public.profiles(unit_id);
create index if not exists municipal_invites_institution_idx on public.municipal_admin_invites(institution_id);
create index if not exists municipal_invites_unit_idx on public.municipal_admin_invites(unit_id);
create index if not exists municipal_invites_hash_idx on public.municipal_admin_invites(token_hash);
create index if not exists municipal_audit_institution_idx on public.municipal_admin_audit_log(institution_id);
create index if not exists municipal_institutions_status_idx on public.institutions(status);
create index if not exists municipal_institutions_created_at_idx on public.institutions(created_at desc);
create index if not exists municipal_units_status_idx on public.units(status);
create index if not exists municipal_units_created_at_idx on public.units(created_at desc);
create index if not exists municipal_profiles_email_idx on public.profiles(email);
create index if not exists municipal_profiles_status_idx on public.profiles(status);
create index if not exists municipal_profiles_created_at_idx on public.profiles(created_at desc);
create index if not exists municipal_invites_email_idx on public.municipal_admin_invites(email);
create index if not exists municipal_invites_status_idx on public.municipal_admin_invites(status);
create index if not exists municipal_invites_created_at_idx on public.municipal_admin_invites(created_at desc);
create index if not exists municipal_audit_created_at_idx on public.municipal_admin_audit_log(created_at desc);

create or replace function public.current_municipal_institution_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select institution_id
  from public.profiles
  where auth_user_id = auth.uid()
    and coalesce(status, 'active') in ('active', 'ativo')
  limit 1;
$$;

create or replace function public.current_municipal_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where auth_user_id = auth.uid()
      and role = 'platform_admin'
      and coalesce(status, 'active') in ('active', 'ativo')
  );
$$;

alter table public.institutions enable row level security;
alter table public.units enable row level security;
alter table public.profiles enable row level security;
alter table public.municipal_admin_invites enable row level security;
alter table public.municipal_admin_audit_log enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'institutions' and policyname = 'municipal_institutions_tenant_select') then
    create policy municipal_institutions_tenant_select on public.institutions for select using (public.current_municipal_is_platform_admin() or id = public.current_municipal_institution_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'units' and policyname = 'municipal_units_tenant_select') then
    create policy municipal_units_tenant_select on public.units for select using (public.current_municipal_is_platform_admin() or institution_id = public.current_municipal_institution_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'municipal_profiles_tenant_select') then
    create policy municipal_profiles_tenant_select on public.profiles for select using (public.current_municipal_is_platform_admin() or auth_user_id = auth.uid() or institution_id = public.current_municipal_institution_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'municipal_admin_audit_log' and policyname = 'municipal_audit_tenant_select') then
    create policy municipal_audit_tenant_select on public.municipal_admin_audit_log for select using (public.current_municipal_is_platform_admin() or institution_id = public.current_municipal_institution_id());
  end if;
end $$;
-- END MODULE: municipal-admin-schema.sql

-- BEGIN MODULE: municipal-operational-stock-schema.sql
-- Contract validated against backend/src/app.js Stock Saude routes and backend/src/data/stock-saude-schema.sql.
create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  name text not null,
  category text,
  unit text not null,
  minimum_quantity numeric(14, 3) not null default 0 check (minimum_quantity >= 0),
  location text,
  batch text,
  expiration_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_entries (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.stock_items(id) on delete restrict,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  quantity numeric(14, 3) not null check (quantity > 0),
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'rejeitada')),
  source text,
  invoice_number text,
  requested_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create table if not exists public.stock_exits (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.stock_items(id) on delete restrict,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  quantity numeric(14, 3) not null check (quantity > 0),
  destination_sector text,
  purpose text,
  responsible_name text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_audit_log (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_stock_items_institution_id on public.stock_items(institution_id);
create index if not exists idx_stock_items_unit_id on public.stock_items(unit_id);
create index if not exists idx_stock_items_expiration_date on public.stock_items(expiration_date);
create index if not exists idx_stock_entries_institution_id on public.stock_entries(institution_id);
create index if not exists idx_stock_entries_unit_id on public.stock_entries(unit_id);
create index if not exists idx_stock_entries_item_id on public.stock_entries(item_id);
create index if not exists idx_stock_entries_status on public.stock_entries(status);
create index if not exists idx_stock_exits_institution_id on public.stock_exits(institution_id);
create index if not exists idx_stock_exits_unit_id on public.stock_exits(unit_id);
create index if not exists idx_stock_exits_item_id on public.stock_exits(item_id);
create index if not exists idx_stock_audit_log_institution_id on public.stock_audit_log(institution_id);
create index if not exists idx_stock_audit_log_unit_id on public.stock_audit_log(unit_id);

alter table public.stock_items enable row level security;
alter table public.stock_entries enable row level security;
alter table public.stock_exits enable row level security;
alter table public.stock_audit_log enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'stock_items' and policyname = 'stock_items_municipal_select') then
    create policy stock_items_municipal_select on public.stock_items for select using (public.current_municipal_is_platform_admin() or institution_id = public.current_municipal_institution_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'stock_entries' and policyname = 'stock_entries_municipal_select') then
    create policy stock_entries_municipal_select on public.stock_entries for select using (public.current_municipal_is_platform_admin() or institution_id = public.current_municipal_institution_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'stock_exits' and policyname = 'stock_exits_municipal_select') then
    create policy stock_exits_municipal_select on public.stock_exits for select using (public.current_municipal_is_platform_admin() or institution_id = public.current_municipal_institution_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'stock_audit_log' and policyname = 'stock_audit_municipal_select') then
    create policy stock_audit_municipal_select on public.stock_audit_log for select using (public.current_municipal_is_platform_admin() or institution_id = public.current_municipal_institution_id());
  end if;
end $$;
-- END MODULE: municipal-operational-stock-schema.sql

-- BEGIN MODULE: municipal-document-schema.sql
create table if not exists public.municipal_documents (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  unit_id uuid references public.units(id),
  title text not null,
  description text,
  document_type text not null default 'outro' check (document_type in ('inventario','inspecao','conferencia','prestacao_contas','nota','termo','relatorio','outro')),
  status text not null default 'active' check (status in ('active','archived')),
  current_version integer not null default 0 check (current_version >= 0),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.municipal_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.municipal_documents(id),
  institution_id uuid not null references public.institutions(id),
  unit_id uuid references public.units(id),
  version_number integer not null check (version_number > 0),
  original_filename text,
  mime_type text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  file_reference text not null,
  file_hash text,
  uploaded_by uuid,
  created_at timestamptz not null default now(),
  unique (document_id, version_number)
);

create index if not exists municipal_documents_institution_idx on public.municipal_documents(institution_id);
create index if not exists municipal_documents_unit_idx on public.municipal_documents(unit_id);
create index if not exists municipal_documents_type_idx on public.municipal_documents(document_type);
create index if not exists municipal_documents_status_idx on public.municipal_documents(status);
create index if not exists municipal_documents_created_at_idx on public.municipal_documents(created_at desc);
create index if not exists municipal_document_versions_document_idx on public.municipal_document_versions(document_id);
create index if not exists municipal_document_versions_institution_idx on public.municipal_document_versions(institution_id);
create index if not exists municipal_document_versions_unit_idx on public.municipal_document_versions(unit_id);
create index if not exists municipal_document_versions_created_at_idx on public.municipal_document_versions(created_at desc);

alter table public.municipal_documents enable row level security;
alter table public.municipal_document_versions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'municipal_documents' and policyname = 'municipal_documents_tenant_select') then
    create policy municipal_documents_tenant_select on public.municipal_documents for select using (public.current_municipal_is_platform_admin() or institution_id = public.current_municipal_institution_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'municipal_document_versions' and policyname = 'municipal_document_versions_tenant_select') then
    create policy municipal_document_versions_tenant_select on public.municipal_document_versions for select using (public.current_municipal_is_platform_admin() or institution_id = public.current_municipal_institution_id());
  end if;
end $$;
-- END MODULE: municipal-document-schema.sql

-- BEGIN MODULE: municipal-asset-schema.sql
create table if not exists public.municipal_assets (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  unit_id uuid not null references public.units(id) on delete restrict,
  asset_tag text not null,
  name text not null,
  description text,
  category text,
  brand text,
  model text,
  serial_number text,
  acquisition_date date,
  acquisition_value numeric(14,2),
  condition text not null default 'bom' check (condition in ('novo', 'bom', 'regular', 'ruim', 'inservivel')),
  status text not null default 'ativo' check (status in ('ativo', 'em_manutencao', 'transferido', 'baixado')),
  location text,
  responsible_user_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint municipal_assets_tag_per_institution_unique unique (institution_id, asset_tag)
);

create table if not exists public.municipal_asset_history (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.municipal_assets(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  unit_id uuid references public.units(id) on delete restrict,
  action text not null,
  actor_user_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists municipal_assets_institution_unit_idx on public.municipal_assets(institution_id, unit_id);
create index if not exists municipal_assets_status_idx on public.municipal_assets(institution_id, status);
create index if not exists municipal_assets_condition_idx on public.municipal_assets(institution_id, condition);
create index if not exists municipal_assets_category_idx on public.municipal_assets(institution_id, category);
create index if not exists municipal_assets_responsible_idx on public.municipal_assets(institution_id, responsible_user_id);
create index if not exists municipal_assets_updated_idx on public.municipal_assets(institution_id, updated_at);
create index if not exists municipal_asset_history_asset_idx on public.municipal_asset_history(asset_id, created_at);
create index if not exists municipal_asset_history_scope_idx on public.municipal_asset_history(institution_id, unit_id, created_at);

alter table public.municipal_assets enable row level security;
alter table public.municipal_asset_history enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'municipal_assets' and policyname = 'municipal_assets_select_scoped') then
    create policy municipal_assets_select_scoped on public.municipal_assets for select using (institution_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'institution_id', '') and (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') in ('platform_admin', 'municipal_admin') or unit_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'unit_id', '')));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'municipal_assets' and policyname = 'municipal_assets_write_admin_scoped') then
    create policy municipal_assets_write_admin_scoped on public.municipal_assets for all using (institution_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'institution_id', '') and nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') in ('platform_admin', 'municipal_admin', 'gestor') and (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') in ('platform_admin', 'municipal_admin') or unit_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'unit_id', ''))) with check (institution_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'institution_id', '') and nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') in ('platform_admin', 'municipal_admin', 'gestor') and (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') in ('platform_admin', 'municipal_admin') or unit_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'unit_id', '')));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'municipal_asset_history' and policyname = 'municipal_asset_history_select_scoped') then
    create policy municipal_asset_history_select_scoped on public.municipal_asset_history for select using (institution_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'institution_id', '') and (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') in ('platform_admin', 'municipal_admin') or unit_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'unit_id', '')));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'municipal_asset_history' and policyname = 'municipal_asset_history_write_admin_scoped') then
    create policy municipal_asset_history_write_admin_scoped on public.municipal_asset_history for insert with check (institution_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'institution_id', '') and nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') in ('platform_admin', 'municipal_admin', 'gestor') and (nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') in ('platform_admin', 'municipal_admin') or unit_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'unit_id', '')));
  end if;
end $$;
-- END MODULE: municipal-asset-schema.sql

-- BEGIN MODULE: municipal-notification-schema.sql
create table if not exists public.municipal_notifications (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  unit_id uuid references public.units(id),
  recipient_user_id uuid not null,
  source_type text not null,
  source_id text not null,
  channel text not null default 'in_app' check (channel in ('in_app', 'email', 'whatsapp')),
  title text not null,
  message text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'delivered', 'read', 'failed', 'cancelled')),
  deduplication_key text not null,
  scheduled_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint municipal_notifications_dedup_unique unique (deduplication_key)
);

create index if not exists municipal_notifications_institution_idx on public.municipal_notifications(institution_id, created_at desc);
create index if not exists municipal_notifications_unit_idx on public.municipal_notifications(institution_id, unit_id, created_at desc);
create index if not exists municipal_notifications_recipient_idx on public.municipal_notifications(recipient_user_id, status, created_at desc);
create index if not exists municipal_notifications_source_idx on public.municipal_notifications(source_type, source_id);
create index if not exists municipal_notifications_status_idx on public.municipal_notifications(status, scheduled_at);

alter table public.municipal_notifications enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'municipal_notifications' and policyname = 'municipal_notifications_select_scoped') then
    create policy municipal_notifications_select_scoped on public.municipal_notifications for select using (institution_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'institution_id', ''));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'municipal_notifications' and policyname = 'municipal_notifications_service_all') then
    create policy municipal_notifications_service_all on public.municipal_notifications for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
end $$;
-- END MODULE: municipal-notification-schema.sql

-- BEGIN MODULE: municipal-sentinel-audit-contract
-- Sentinela Municipal MVP is computed from stock, documents, assets and audit tables.
-- It does not require a dedicated alerts table in this package.
-- Actions are registered in public.municipal_admin_audit_log.
-- END MODULE: municipal-sentinel-audit-contract