-- Stock Full SaaS Aberto 2 - Supabase real
-- Execute no SQL Editor do Supabase.

create extension if not exists pgcrypto;

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
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'leitura' check (role in ('admin','estoquista','vendedor','leitura')),
  status text not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

create index if not exists profiles_company_id_idx on public.profiles(company_id);
create index if not exists profiles_auth_user_id_idx on public.profiles(auth_user_id);
create index if not exists products_company_id_idx on public.products(company_id);
create index if not exists products_company_sku_idx on public.products(company_id, sku);
create index if not exists stock_movements_company_id_idx on public.stock_movements(company_id);
create index if not exists stock_movements_product_id_idx on public.stock_movements(product_id);
create index if not exists imports_company_id_idx on public.imports(company_id);
create index if not exists audit_logs_company_id_idx on public.audit_logs(company_id);

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where auth_user_id = auth.uid() and status = 'ativo' limit 1;
$$;

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;
alter table public.imports enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists companies_same_company_select on public.companies;
create policy companies_same_company_select on public.companies
  for select using (id = public.current_company_id());

drop policy if exists profiles_same_company_select on public.profiles;
create policy profiles_same_company_select on public.profiles
  for select using (company_id = public.current_company_id());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

drop policy if exists products_company_all on public.products;
create policy products_company_all on public.products
  for all using (company_id = public.current_company_id()) with check (company_id = public.current_company_id());

drop policy if exists stock_movements_company_all on public.stock_movements;
create policy stock_movements_company_all on public.stock_movements
  for all using (company_id = public.current_company_id()) with check (company_id = public.current_company_id());

drop policy if exists imports_company_all on public.imports;
create policy imports_company_all on public.imports
  for all using (company_id = public.current_company_id()) with check (company_id = public.current_company_id());

drop policy if exists audit_logs_company_all on public.audit_logs;
create policy audit_logs_company_all on public.audit_logs
  for all using (company_id = public.current_company_id()) with check (company_id = public.current_company_id());
