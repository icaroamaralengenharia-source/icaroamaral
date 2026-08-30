do $$
begin
  if to_regclass('public.institutions') is null then
    raise exception 'Missing dependency: public.institutions must exist before institution_module_entitlements migration';
  end if;

  if to_regclass('public.profiles') is null then
    raise exception 'Missing dependency: public.profiles must exist before institution_module_entitlements migration';
  end if;

  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name = 'auth_user_id'
  ) then
    raise exception 'Missing dependency: public.profiles.auth_user_id must exist before institution_module_entitlements migration';
  end if;

  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name = 'institution_id'
  ) then
    raise exception 'Missing dependency: public.profiles.institution_id must exist before institution_module_entitlements migration';
  end if;

  if to_regprocedure('gen_random_uuid()') is null then
    raise exception 'Missing dependency: gen_random_uuid() must exist before institution_module_entitlements migration';
  end if;
end;
$$;

create table public.institution_module_entitlements (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  module_key text not null,
  status text not null,
  trial_limit integer not null,
  trial_used integer not null default 0,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institution_module_entitlements_module_key_check
    check (module_key in ('apartment_handover')),
  constraint institution_module_entitlements_status_check
    check (status in ('trial_active', 'trial_exhausted', 'active', 'blocked')),
  constraint institution_module_entitlements_trial_limit_check
    check (trial_limit >= 0),
  constraint institution_module_entitlements_trial_used_check
    check (trial_used >= 0 and trial_used <= trial_limit),
  constraint institution_module_entitlements_institution_module_unique
    unique (institution_id, module_key),
  constraint institution_module_entitlements_id_institution_module_unique
    unique (id, institution_id, module_key)
);

create table public.institution_module_trial_usages (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid not null,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  module_key text not null,
  inspection_id uuid not null,
  consumed_at timestamptz not null default now(),
  constraint institution_module_trial_usages_module_key_check
    check (module_key in ('apartment_handover')),
  constraint institution_module_trial_usages_entitlement_institution_module_fk
    foreign key (entitlement_id, institution_id, module_key)
    references public.institution_module_entitlements(id, institution_id, module_key)
    on delete cascade,
  constraint institution_module_trial_usages_institution_module_inspection_unique
    unique (institution_id, module_key, inspection_id)
);

create index institution_module_entitlements_institution_id_idx
  on public.institution_module_entitlements(institution_id);

create index institution_module_entitlements_module_status_idx
  on public.institution_module_entitlements(module_key, status);

create index institution_module_trial_usages_entitlement_id_idx
  on public.institution_module_trial_usages(entitlement_id);

create index institution_module_trial_usages_institution_module_idx
  on public.institution_module_trial_usages(institution_id, module_key);

create function public.set_institution_module_entitlements_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_institution_module_entitlements_updated_at() from public;

create trigger institution_module_entitlements_updated_at
  before update on public.institution_module_entitlements
  for each row
  execute function public.set_institution_module_entitlements_updated_at();

create function public.consume_apartment_handover_trial_usage(
  p_institution_id uuid,
  p_inspection_id uuid,
  p_consume boolean default true
)
returns table (
  allowed boolean,
  consumed boolean,
  status text,
  code text,
  trial_used integer,
  trial_limit integer,
  remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_module_key constant text := 'apartment_handover';
  v_entitlement public.institution_module_entitlements%rowtype;
  v_has_usage boolean := false;
  v_new_used integer;
begin
  if p_institution_id is null then
    return query select false, false, 'no_institution'::text, 'INSTITUTION_REQUIRED'::text, 0, 0, 0;
    return;
  end if;

  if p_inspection_id is null then
    return query select false, false, 'missing_inspection_id'::text, 'INSPECTION_ID_REQUIRED'::text, 0, 0, 0;
    return;
  end if;

  select *
    into v_entitlement
    from public.institution_module_entitlements
   where institution_id = p_institution_id
     and module_key = v_module_key
   for update;

  if not found then
    return query select false, false, 'no_entitlement'::text, 'NO_ENTITLEMENT'::text, 0, 0, 0;
    return;
  end if;

  if v_entitlement.status = 'blocked' then
    return query select false, false, 'blocked'::text, 'MODULE_BLOCKED'::text, v_entitlement.trial_used, v_entitlement.trial_limit, greatest(v_entitlement.trial_limit - v_entitlement.trial_used, 0);
    return;
  end if;

  if v_entitlement.status = 'active' then
    return query select true, false, 'active'::text, null::text, v_entitlement.trial_used, v_entitlement.trial_limit, null::integer;
    return;
  end if;

  select exists (
    select 1
      from public.institution_module_trial_usages
     where institution_id = p_institution_id
       and module_key = v_module_key
       and inspection_id = p_inspection_id
  ) into v_has_usage;

  if v_has_usage then
    return query select true, false, v_entitlement.status, null::text, v_entitlement.trial_used, v_entitlement.trial_limit, greatest(v_entitlement.trial_limit - v_entitlement.trial_used, 0);
    return;
  end if;

  if v_entitlement.status = 'trial_exhausted' then
    return query select false, false, 'trial_exhausted'::text, 'TRIAL_EXHAUSTED'::text, v_entitlement.trial_used, v_entitlement.trial_limit, 0;
    return;
  end if;

  if v_entitlement.trial_used >= v_entitlement.trial_limit then
    update public.institution_module_entitlements
       set status = 'trial_exhausted'
     where id = v_entitlement.id;

    return query select false, false, 'trial_exhausted'::text, 'TRIAL_EXHAUSTED'::text, v_entitlement.trial_used, v_entitlement.trial_limit, 0;
    return;
  end if;

  if not p_consume then
    return query select true, false, v_entitlement.status, null::text, v_entitlement.trial_used, v_entitlement.trial_limit, greatest(v_entitlement.trial_limit - v_entitlement.trial_used, 0);
    return;
  end if;

  insert into public.institution_module_trial_usages (entitlement_id, institution_id, module_key, inspection_id)
  values (v_entitlement.id, p_institution_id, v_module_key, p_inspection_id)
  on conflict (institution_id, module_key, inspection_id) do nothing;

  if not found then
    return query select true, false, v_entitlement.status, null::text, v_entitlement.trial_used, v_entitlement.trial_limit, greatest(v_entitlement.trial_limit - v_entitlement.trial_used, 0);
    return;
  end if;

  v_new_used := v_entitlement.trial_used + 1;

  update public.institution_module_entitlements
     set trial_used = v_new_used,
         status = case when v_new_used >= v_entitlement.trial_limit then 'trial_exhausted' else 'trial_active' end
   where id = v_entitlement.id
  returning * into v_entitlement;

  return query select true, true, v_entitlement.status, null::text, v_entitlement.trial_used, v_entitlement.trial_limit, greatest(v_entitlement.trial_limit - v_entitlement.trial_used, 0);
end;
$$;

revoke all on function public.consume_apartment_handover_trial_usage(uuid, uuid, boolean) from public;
revoke all on function public.consume_apartment_handover_trial_usage(uuid, uuid, boolean) from authenticated;
grant execute on function public.consume_apartment_handover_trial_usage(uuid, uuid, boolean) to service_role;

alter table public.institution_module_entitlements enable row level security;
alter table public.institution_module_trial_usages enable row level security;

drop policy if exists institution_module_entitlements_same_institution_select on public.institution_module_entitlements;
create policy institution_module_entitlements_same_institution_select
  on public.institution_module_entitlements
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.profiles p
       where p.auth_user_id = auth.uid()
         and p.institution_id = institution_module_entitlements.institution_id
    )
  );

drop policy if exists institution_module_trial_usages_same_institution_select on public.institution_module_trial_usages;
create policy institution_module_trial_usages_same_institution_select
  on public.institution_module_trial_usages
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.profiles p
       where p.auth_user_id = auth.uid()
         and p.institution_id = institution_module_trial_usages.institution_id
    )
  );

-- No insert/update/delete policy for authenticated users.
-- Commercial activation and trial usage transitions must be performed by the backend/service role.
-- inspection_id is application-owned in this phase; no safe inspections table FK exists in the current schema.
