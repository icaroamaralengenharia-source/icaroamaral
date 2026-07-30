create extension if not exists pgcrypto;

-- MVP Municipal - Bloco A + B
-- Referencia aditiva. Nao executar automaticamente.
-- institution_id representa a prefeitura/tenant municipal.
-- unit_id representa almoxarifado/unidade.
-- company_id permanece apenas para compatibilidade legada.

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
-- Bloco E - hardening idempotente para homologacao controlada.
-- Backend municipal opera com service_role; RLS abaixo evita leitura direta ampla por anon/authenticated.

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
    create policy municipal_institutions_tenant_select
      on public.institutions
      for select
      using (public.current_municipal_is_platform_admin() or id = public.current_municipal_institution_id());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'units' and policyname = 'municipal_units_tenant_select') then
    create policy municipal_units_tenant_select
      on public.units
      for select
      using (public.current_municipal_is_platform_admin() or institution_id = public.current_municipal_institution_id());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'municipal_profiles_tenant_select') then
    create policy municipal_profiles_tenant_select
      on public.profiles
      for select
      using (public.current_municipal_is_platform_admin() or auth_user_id = auth.uid() or institution_id = public.current_municipal_institution_id());
  end if;
end $$;
