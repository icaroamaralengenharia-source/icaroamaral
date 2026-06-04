create extension if not exists pgcrypto;

-- RLS será ativado na Fase 2.5 após autenticação e perfis.

create table if not exists institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  document text,
  created_at timestamptz not null default now()
);

create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  name text not null,
  type text,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  institution_id uuid not null references institutions(id) on delete cascade,
  unit_id uuid references units(id) on delete set null,
  name text not null,
  email text not null,
  role text not null check (role in ('admin', 'administrador', 'gestor', 'almoxarife', 'leitura')),
  created_at timestamptz not null default now()
);

create table if not exists stock_saude_invites (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  unit_id uuid references units(id) on delete set null,
  email text not null,
  role text not null check (role in ('administrador', 'gestor', 'almoxarife', 'leitura')),
  created_by uuid references profiles(id) on delete set null,
  status text not null default 'pendente' check (status in ('pendente', 'aceito', 'cancelado')),
  created_at timestamptz not null default now()
);

create table if not exists stock_items (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  unit_id uuid not null references units(id) on delete cascade,
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

create table if not exists stock_entries (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references stock_items(id) on delete restrict,
  institution_id uuid not null references institutions(id) on delete cascade,
  unit_id uuid not null references units(id) on delete cascade,
  quantity numeric(14, 3) not null check (quantity > 0),
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'rejeitada')),
  source text,
  invoice_number text,
  requested_by uuid references profiles(id) on delete set null,
  approved_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create table if not exists stock_exits (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references stock_items(id) on delete restrict,
  institution_id uuid not null references institutions(id) on delete cascade,
  unit_id uuid not null references units(id) on delete cascade,
  quantity numeric(14, 3) not null check (quantity > 0),
  destination_sector text,
  purpose text,
  responsible_name text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists stock_audit_log (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  unit_id uuid references units(id) on delete set null,
  profile_id uuid references profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_units_institution_id
  on units(institution_id);

create index if not exists idx_profiles_institution_id
  on profiles(institution_id);

create index if not exists idx_profiles_unit_id
  on profiles(unit_id);

create index if not exists idx_profiles_auth_user_id
  on profiles(auth_user_id);

create index if not exists idx_stock_saude_invites_institution_id
  on stock_saude_invites(institution_id);

create index if not exists idx_stock_saude_invites_unit_id
  on stock_saude_invites(unit_id);

create index if not exists idx_stock_saude_invites_status
  on stock_saude_invites(status);

create index if not exists idx_stock_saude_invites_email
  on stock_saude_invites(email);

create index if not exists idx_stock_items_institution_id
  on stock_items(institution_id);

create index if not exists idx_stock_items_unit_id
  on stock_items(unit_id);

create index if not exists idx_stock_items_expiration_date
  on stock_items(expiration_date);

create index if not exists idx_stock_entries_institution_id
  on stock_entries(institution_id);

create index if not exists idx_stock_entries_unit_id
  on stock_entries(unit_id);

create index if not exists idx_stock_entries_item_id
  on stock_entries(item_id);

create index if not exists idx_stock_entries_status
  on stock_entries(status);

create index if not exists idx_stock_exits_institution_id
  on stock_exits(institution_id);

create index if not exists idx_stock_exits_unit_id
  on stock_exits(unit_id);

create index if not exists idx_stock_exits_item_id
  on stock_exits(item_id);

create index if not exists idx_stock_audit_log_institution_id
  on stock_audit_log(institution_id);

create index if not exists idx_stock_audit_log_unit_id
  on stock_audit_log(unit_id);
