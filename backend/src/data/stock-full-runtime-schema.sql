-- Stock Full runtime schema
-- Compatível com o backend atual em backend/src/app.js.
-- Execute manualmente no SQL Editor do Supabase somente após revisão.
--
-- RLS pode ser ativado futuramente quando houver política definida.
-- Backend atual usa SERVICE_ROLE_KEY e valida institution_id nas rotas.

create extension if not exists pgcrypto;

create or replace function public.set_stock_full_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  institution_id text not null,
  unit_id text,
  name text,
  email text unique not null,
  role text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
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
  item_id uuid not null,
  quantity numeric not null,
  unit_cost numeric,
  supplier text,
  invoice_number text,
  notes text,
  created_by uuid,
  created_at timestamptz default now(),
  constraint stock_full_entries_quantity_positive check (quantity > 0),
  constraint stock_full_entries_item_id_fk foreign key (item_id)
    references public.stock_full_items(id)
    on delete restrict
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
  item_id uuid not null,
  quantity numeric not null,
  destination text,
  responsible text,
  notes text,
  created_by uuid,
  created_at timestamptz default now(),
  constraint stock_full_exits_quantity_positive check (quantity > 0),
  constraint stock_full_exits_item_id_fk foreign key (item_id)
    references public.stock_full_items(id)
    on delete restrict
);


alter table if exists public.stock_full_entries
  add column if not exists offline_uuid text,
  add column if not exists operation_id text,
  add column if not exists device_id text,
  add column if not exists sync_status text default 'synced',
  add column if not exists source text default 'online',
  add column if not exists synced_at timestamptz;

alter table if exists public.stock_full_exits
  add column if not exists offline_uuid text,
  add column if not exists operation_id text,
  add column if not exists device_id text,
  add column if not exists sync_status text default 'synced',
  add column if not exists source text default 'online',
  add column if not exists synced_at timestamptz;

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

create index if not exists profiles_email_idx
  on public.profiles(email);

create index if not exists profiles_auth_user_id_idx
  on public.profiles(auth_user_id);

create index if not exists profiles_institution_id_idx
  on public.profiles(institution_id);

create index if not exists stock_full_items_institution_id_idx
  on public.stock_full_items(institution_id);

create index if not exists stock_full_items_is_active_idx
  on public.stock_full_items(is_active);

create index if not exists stock_full_entries_institution_id_idx
  on public.stock_full_entries(institution_id);

create index if not exists stock_full_entries_item_id_idx
  on public.stock_full_entries(item_id);

create unique index if not exists stock_full_entries_offline_uuid_idx
  on public.stock_full_entries(institution_id, offline_uuid)
  where offline_uuid is not null;

create index if not exists stock_full_exits_institution_id_idx
  on public.stock_full_exits(institution_id);

create index if not exists stock_full_exits_item_id_idx
  on public.stock_full_exits(item_id);

create unique index if not exists stock_full_exits_offline_uuid_idx
  on public.stock_full_exits(institution_id, offline_uuid)
  where offline_uuid is not null;

create index if not exists stock_full_audit_log_institution_id_idx
  on public.stock_full_audit_log(institution_id);

create index if not exists stock_full_audit_log_product_id_idx
  on public.stock_full_audit_log(product_id);

create index if not exists stock_full_audit_log_created_at_idx
  on public.stock_full_audit_log(created_at desc);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_stock_full_updated_at();

drop trigger if exists stock_full_items_set_updated_at on public.stock_full_items;
create trigger stock_full_items_set_updated_at
before update on public.stock_full_items
for each row
execute function public.set_stock_full_updated_at();

-- Exemplo de perfil admin após criar o usuário em Supabase Auth:
-- insert into public.profiles (auth_user_id, institution_id, unit_id, name, email, role)
-- values ('UUID_DO_AUTH_USER', 'empresa-teste', 'matriz', 'Admin Teste', 'admin@empresa.com', 'admin');

-- Exemplo de perfil operador após criar o usuário em Supabase Auth:
-- insert into public.profiles (auth_user_id, institution_id, unit_id, name, email, role)
-- values ('UUID_DO_AUTH_USER', 'empresa-teste', 'matriz', 'Operador Teste', 'operador@empresa.com', 'operador');
