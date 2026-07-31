-- Municipal assets schema - additive and idempotent.
-- Do not run automatically; apply only to the authorized municipal database.

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
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'municipal_assets'
      and policyname = 'municipal_assets_select_scoped'
  ) then
    create policy municipal_assets_select_scoped
      on public.municipal_assets for select
      using (
        institution_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'institution_id', '')
        and (
          nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') in ('platform_admin', 'municipal_admin')
          or unit_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'unit_id', '')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'municipal_assets'
      and policyname = 'municipal_assets_write_admin_scoped'
  ) then
    create policy municipal_assets_write_admin_scoped
      on public.municipal_assets for all
      using (
        institution_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'institution_id', '')
        and nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') in ('platform_admin', 'municipal_admin', 'gestor')
        and (
          nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') in ('platform_admin', 'municipal_admin')
          or unit_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'unit_id', '')
        )
      )
      with check (
        institution_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'institution_id', '')
        and nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') in ('platform_admin', 'municipal_admin', 'gestor')
        and (
          nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') in ('platform_admin', 'municipal_admin')
          or unit_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'unit_id', '')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'municipal_asset_history'
      and policyname = 'municipal_asset_history_select_scoped'
  ) then
    create policy municipal_asset_history_select_scoped
      on public.municipal_asset_history for select
      using (
        institution_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'institution_id', '')
        and (
          nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') in ('platform_admin', 'municipal_admin')
          or unit_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'unit_id', '')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'municipal_asset_history'
      and policyname = 'municipal_asset_history_write_admin_scoped'
  ) then
    create policy municipal_asset_history_write_admin_scoped
      on public.municipal_asset_history for insert
      with check (
        institution_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'institution_id', '')
        and nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') in ('platform_admin', 'municipal_admin', 'gestor')
        and (
          nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') in ('platform_admin', 'municipal_admin')
          or unit_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'unit_id', '')
        )
      );
  end if;
end $$;