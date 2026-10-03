-- Stock Full work scope migration v1.
-- Canonical work source: public.obrareport_projects.id (project_id in Stock Full).
-- This migration never assigns a legacy row by tenant alone. Rows remain NULL when
-- their work cannot be determined exactly and are excluded from work-scoped routes.

alter table public.stock_full_items
  add column if not exists project_id text;
alter table public.stock_full_entries
  add column if not exists project_id text;
alter table public.stock_full_exits
  add column if not exists project_id text;
alter table public.stock_full_audit_log
  add column if not exists project_id text;

do $$
begin
  if to_regclass('public.obrareport_projects') is null then
    raise exception 'stock_full_canonical_work_table_missing';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stock_full_items_project_id_fk'
      and conrelid = 'public.stock_full_items'::regclass
  ) then
    alter table public.stock_full_items
      add constraint stock_full_items_project_id_fk
      foreign key (project_id) references public.obrareport_projects(id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'stock_full_entries_project_id_fk'
      and conrelid = 'public.stock_full_entries'::regclass
  ) then
    alter table public.stock_full_entries
      add constraint stock_full_entries_project_id_fk
      foreign key (project_id) references public.obrareport_projects(id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'stock_full_exits_project_id_fk'
      and conrelid = 'public.stock_full_exits'::regclass
  ) then
    alter table public.stock_full_exits
      add constraint stock_full_exits_project_id_fk
      foreign key (project_id) references public.obrareport_projects(id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'stock_full_audit_log_project_id_fk'
      and conrelid = 'public.stock_full_audit_log'::regclass
  ) then
    alter table public.stock_full_audit_log
      add constraint stock_full_audit_log_project_id_fk
      foreign key (project_id) references public.obrareport_projects(id);
  end if;
end $$;

-- Deterministic E2E backfill only: the tenant has exactly one canonical work and
-- the item location is the exact canonical display name. No other legacy row moves.
with unique_work as (
  select institution_id, min(id) as project_id
  from public.obrareport_projects
  group by institution_id
  having count(*) = 1
), deterministic_items as (
  select i.id, w.project_id
  from public.stock_full_items i
  join unique_work w on w.institution_id = i.institution_id
  where i.project_id is null
    and btrim(coalesce(i.location, '')) = 'E2E ELO — Residência Teste'
)
update public.stock_full_items i
set project_id = d.project_id,
    updated_at = coalesce(i.updated_at, now())
from deterministic_items d
where i.id = d.id;

update public.stock_full_entries e
set project_id = i.project_id
from public.stock_full_items i
where e.project_id is null
  and e.item_id = i.id
  and i.project_id is not null;

update public.stock_full_exits e
set project_id = i.project_id
from public.stock_full_items i
where e.project_id is null
  and e.item_id = i.id
  and i.project_id is not null;

update public.stock_full_audit_log a
set project_id = i.project_id
from public.stock_full_items i
where a.project_id is null
  and a.product_id = i.id
  and i.project_id is not null;

create index if not exists stock_full_items_institution_project_idx
  on public.stock_full_items(institution_id, project_id, name);
create index if not exists stock_full_entries_institution_project_idx
  on public.stock_full_entries(institution_id, project_id, created_at desc);
create index if not exists stock_full_exits_institution_project_idx
  on public.stock_full_exits(institution_id, project_id, created_at desc);
create index if not exists stock_full_audit_log_institution_project_idx
  on public.stock_full_audit_log(institution_id, project_id, created_at desc);
create unique index if not exists stock_full_items_work_name_idx
  on public.stock_full_items(institution_id, project_id, lower(name))
  where project_id is not null and is_active = true;

create or replace function public.stock_full_current_institution_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.institution_id
  from public.profiles p
  where p.auth_user_id = auth.uid()
  order by p.created_at desc nulls last
  limit 1;
$$;

create or replace function public.stock_full_current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.auth_user_id = auth.uid()
  order by p.created_at desc nulls last
  limit 1;
$$;

revoke all on function public.stock_full_current_institution_id() from public;
revoke all on function public.stock_full_current_profile_id() from public;
grant execute on function public.stock_full_current_institution_id() to authenticated;
grant execute on function public.stock_full_current_profile_id() to authenticated;

create or replace function public.stock_full_work_allowed(p_project_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.obrareport_projects p
    where p.id = nullif(btrim(p_project_id), '')
      and p.institution_id = public.stock_full_current_institution_id()
  );
$$;

revoke all on function public.stock_full_work_allowed(text) from public;
grant execute on function public.stock_full_work_allowed(text) to authenticated;

create or replace function public.stock_full_prevent_work_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.project_id is distinct from old.project_id then
    raise exception 'stock_full_work_immutable';
  end if;
  return new;
end;
$$;

create or replace function public.stock_full_validate_movement_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item_project_id text;
begin
  if new.project_id is null or btrim(new.project_id) = '' then
    raise exception 'WORK_REQUIRED';
  end if;
  select project_id into item_project_id
  from public.stock_full_items
  where id = new.item_id
    and institution_id = new.institution_id
    and is_active = true;
  if not found or item_project_id is distinct from new.project_id then
    raise exception 'stock_full_item_work_mismatch';
  end if;
  return new;
end;
$$;

drop trigger if exists stock_full_items_work_immutable on public.stock_full_items;
create trigger stock_full_items_work_immutable
before update on public.stock_full_items
for each row execute function public.stock_full_prevent_work_change();

drop trigger if exists stock_full_entries_work_immutable on public.stock_full_entries;
create trigger stock_full_entries_work_immutable
before update on public.stock_full_entries
for each row execute function public.stock_full_prevent_work_change();

drop trigger if exists stock_full_exits_work_immutable on public.stock_full_exits;
create trigger stock_full_exits_work_immutable
before update on public.stock_full_exits
for each row execute function public.stock_full_prevent_work_change();

drop trigger if exists stock_full_audit_work_immutable on public.stock_full_audit_log;
create trigger stock_full_audit_work_immutable
before update on public.stock_full_audit_log
for each row execute function public.stock_full_prevent_work_change();

drop trigger if exists stock_full_entries_scope_validate on public.stock_full_entries;
create trigger stock_full_entries_scope_validate
before insert or update on public.stock_full_entries
for each row execute function public.stock_full_validate_movement_scope();

drop trigger if exists stock_full_exits_scope_validate on public.stock_full_exits;
create trigger stock_full_exits_scope_validate
before insert or update on public.stock_full_exits
for each row execute function public.stock_full_validate_movement_scope();

-- The NFe RPC is versioned with the same required work scope. The legacy
-- six-argument overload is removed so it cannot create projectless rows.
drop function if exists public.confirm_stock_full_nfe_import(uuid, uuid, text, uuid, jsonb, jsonb);
drop function if exists public.confirm_stock_full_nfe_import(text, uuid, text, uuid, jsonb, jsonb);

create or replace function public.confirm_stock_full_nfe_import(
  p_institution_id uuid,
  p_profile_id uuid,
  p_nfe_access_key text,
  p_item_id uuid default null,
  p_product jsonb default null,
  p_movement jsonb default '{}'::jsonb,
  p_project_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_item public.stock_full_items%rowtype;
  v_entry public.stock_full_entries%rowtype;
  v_audit public.stock_full_audit_log%rowtype;
  v_quantity numeric;
  v_unit_cost numeric;
  v_previous_balance numeric;
  v_next_balance numeric;
  v_operation_id text;
  v_offline_uuid text;
  v_project_id text := nullif(btrim(coalesce(p_project_id, p_movement ->> 'project_id', '')), '');
  v_now timestamptz := now();
  v_institution_id_text text := p_institution_id::text;
begin
  if p_institution_id is null then
    raise exception 'institution_id_required';
  end if;
  if v_institution_id_text <> public.stock_full_current_institution_id() then
    raise exception 'stock_full_institution_not_allowed';
  end if;
  if v_project_id is null then
    raise exception 'WORK_REQUIRED';
  end if;
  if not public.stock_full_work_allowed(v_project_id) then
    raise exception 'WORK_NOT_ALLOWED';
  end if;
  if btrim(coalesce(p_nfe_access_key, '')) = '' then
    raise exception 'nfe_access_key_required';
  end if;

  select * into v_profile
  from public.profiles
  where id = p_profile_id
    and institution_id = p_institution_id
    and auth_user_id = auth.uid()
  limit 1;
  if not found then
    raise exception 'stock_full_profile_not_found';
  end if;
  if lower(coalesce(v_profile.role, '')) in ('leitura', 'viewer', 'read_only') then
    raise exception 'permission_denied';
  end if;

  v_quantity := nullif(p_movement ->> 'quantity', '')::numeric;
  if v_quantity is null or v_quantity <= 0 then
    raise exception 'quantity_required';
  end if;
  v_unit_cost := nullif(p_movement ->> 'unit_cost', '')::numeric;
  v_operation_id := btrim(coalesce(p_movement ->> 'operation_id', ''));
  v_offline_uuid := btrim(coalesce(p_movement ->> 'offline_uuid', v_operation_id, ''));

  select * into v_entry
  from public.stock_full_entries
  where institution_id = v_institution_id_text
    and project_id = v_project_id
    and (
      (v_offline_uuid <> '' and offline_uuid = v_offline_uuid)
      or (v_operation_id <> '' and operation_id = v_operation_id)
    )
  limit 1;
  if found then
    select * into v_item from public.stock_full_items
    where id = v_entry.item_id and project_id = v_project_id limit 1;
    return jsonb_build_object('status', 'duplicate', 'duplicate', true, 'entry', to_jsonb(v_entry), 'item', to_jsonb(v_item));
  end if;

  select * into v_entry
  from public.stock_full_entries
  where institution_id = v_institution_id_text
    and project_id = v_project_id
    and nfe_access_key = p_nfe_access_key
  limit 1;
  if found then
    select * into v_item from public.stock_full_items
    where id = v_entry.item_id and project_id = v_project_id limit 1;
    return jsonb_build_object('status', 'duplicate', 'duplicate', true, 'entry', to_jsonb(v_entry), 'item', to_jsonb(v_item));
  end if;

  if p_item_id is null then
    if p_product is null then
      raise exception 'stock_full_item_required';
    end if;
    insert into public.stock_full_items (
      institution_id, project_id, name, unit, category, min_quantity,
      current_quantity, location, notes, is_active, created_by, created_at, updated_at
    ) values (
      v_institution_id_text, v_project_id,
      btrim(coalesce(p_product ->> 'name', '')),
      coalesce(nullif(btrim(coalesce(p_product ->> 'unit', '')), ''), 'un'),
      coalesce(nullif(btrim(coalesce(p_product ->> 'category', '')), ''), 'Geral'),
      coalesce(nullif(p_product ->> 'min_quantity', '')::numeric, 0),
      0,
      btrim(coalesce(p_product ->> 'location', '')),
      btrim(coalesce(p_product ->> 'notes', '')),
      true, p_profile_id, v_now, v_now
    ) returning * into v_item;
  else
    select * into v_item
    from public.stock_full_items
    where id = p_item_id
      and institution_id = v_institution_id_text
      and project_id = v_project_id
      and is_active = true
    for update;
    if not found then
      raise exception 'stock_full_item_not_found';
    end if;
  end if;

  if btrim(coalesce(v_item.name, '')) = '' then
    raise exception 'name_required';
  end if;

  v_previous_balance := coalesce(v_item.current_quantity, 0);
  v_next_balance := v_previous_balance + v_quantity;

  update public.stock_full_items
  set current_quantity = v_next_balance, updated_at = v_now
  where id = v_item.id
    and institution_id = v_institution_id_text
    and project_id = v_project_id
    and is_active = true
  returning * into v_item;

  insert into public.stock_full_entries (
    institution_id, project_id, offline_uuid, operation_id, device_id, sync_status,
    source, synced_at, item_id, quantity, unit_cost, supplier, invoice_number,
    nfe_access_key, notes, created_by, created_at
  ) values (
    v_institution_id_text, v_project_id,
    nullif(v_offline_uuid, ''), nullif(v_operation_id, ''),
    nullif(btrim(coalesce(p_movement ->> 'device_id', '')), ''),
    coalesce(nullif(btrim(coalesce(p_movement ->> 'sync_status', '')), ''), 'synced'),
    coalesce(nullif(btrim(coalesce(p_movement ->> 'source', '')), ''), 'online'),
    v_now, v_item.id, v_quantity, v_unit_cost,
    btrim(coalesce(p_movement ->> 'supplier', '')),
    btrim(coalesce(p_movement ->> 'invoice_number', p_nfe_access_key)),
    p_nfe_access_key, btrim(coalesce(p_movement ->> 'notes', '')),
    p_profile_id, v_now
  ) returning * into v_entry;

  insert into public.stock_full_audit_log (
    institution_id, project_id, action, entity_type, entity_id, product_id,
    before_data, after_data, device_id, offline_uuid, operation_id, source,
    description, created_by, created_at
  ) values (
    v_institution_id_text, v_project_id, 'stock_full_nfe_imported',
    'stock_full_entry', v_entry.id, v_item.id,
    jsonb_build_object('current_quantity', v_previous_balance),
    jsonb_build_object('current_quantity', v_next_balance, 'quantity', v_quantity,
      'nfe_access_key', p_nfe_access_key),
    nullif(btrim(coalesce(p_movement ->> 'device_id', '')), ''),
    nullif(v_offline_uuid, ''), nullif(v_operation_id, ''),
    coalesce(nullif(btrim(coalesce(p_movement ->> 'source', '')), ''), 'online'),
    'NF-e importada no Stock Full.', p_profile_id, v_now
  ) returning * into v_audit;

  return jsonb_build_object('status', 'synced', 'duplicate', false,
    'entry', to_jsonb(v_entry), 'item', to_jsonb(v_item), 'audit', to_jsonb(v_audit));
exception
  when unique_violation then
    select * into v_entry
    from public.stock_full_entries
    where institution_id = v_institution_id_text
      and project_id = v_project_id
      and (
        nfe_access_key = p_nfe_access_key
        or (v_offline_uuid <> '' and offline_uuid = v_offline_uuid)
        or (v_operation_id <> '' and operation_id = v_operation_id)
      )
    limit 1;
    if found then
      select * into v_item from public.stock_full_items
      where id = v_entry.item_id and project_id = v_project_id limit 1;
      return jsonb_build_object('status', 'duplicate', 'duplicate', true,
        'entry', to_jsonb(v_entry), 'item', to_jsonb(v_item));
    end if;
    raise;
end;
$$;

revoke all on function public.confirm_stock_full_nfe_import(uuid, uuid, text, uuid, jsonb, jsonb, text) from public;
revoke all on function public.confirm_stock_full_nfe_import(uuid, uuid, text, uuid, jsonb, jsonb, text) from anon;
grant execute on function public.confirm_stock_full_nfe_import(uuid, uuid, text, uuid, jsonb, jsonb, text) to authenticated;

-- Reapply the work-scoped policies in the same migration, so the schema and
-- runtime authorization cannot be deployed out of order.
alter table public.stock_full_items enable row level security;
alter table public.stock_full_entries enable row level security;
alter table public.stock_full_exits enable row level security;
alter table public.stock_full_audit_log enable row level security;

drop policy if exists stock_full_runtime_items_select on public.stock_full_items;
create policy stock_full_runtime_items_select on public.stock_full_items for select to authenticated
using (institution_id = public.stock_full_current_institution_id() and project_id is not null and public.stock_full_work_allowed(project_id));
drop policy if exists stock_full_runtime_items_insert on public.stock_full_items;
create policy stock_full_runtime_items_insert on public.stock_full_items for insert to authenticated
with check (institution_id = public.stock_full_current_institution_id() and project_id is not null and public.stock_full_work_allowed(project_id) and created_by = public.stock_full_current_profile_id());
drop policy if exists stock_full_runtime_items_update on public.stock_full_items;
create policy stock_full_runtime_items_update on public.stock_full_items for update to authenticated
using (institution_id = public.stock_full_current_institution_id() and project_id is not null and public.stock_full_work_allowed(project_id))
with check (institution_id = public.stock_full_current_institution_id() and project_id is not null and public.stock_full_work_allowed(project_id));
drop policy if exists stock_full_runtime_items_delete on public.stock_full_items;
create policy stock_full_runtime_items_delete on public.stock_full_items for delete to authenticated
using (institution_id = public.stock_full_current_institution_id() and project_id is not null and public.stock_full_work_allowed(project_id));

drop policy if exists stock_full_runtime_entries_select on public.stock_full_entries;
create policy stock_full_runtime_entries_select on public.stock_full_entries for select to authenticated
using (institution_id = public.stock_full_current_institution_id() and project_id is not null and public.stock_full_work_allowed(project_id));
drop policy if exists stock_full_runtime_entries_insert on public.stock_full_entries;
create policy stock_full_runtime_entries_insert on public.stock_full_entries for insert to authenticated
with check (institution_id = public.stock_full_current_institution_id() and project_id is not null and public.stock_full_work_allowed(project_id) and created_by = public.stock_full_current_profile_id());

drop policy if exists stock_full_runtime_exits_select on public.stock_full_exits;
create policy stock_full_runtime_exits_select on public.stock_full_exits for select to authenticated
using (institution_id = public.stock_full_current_institution_id() and project_id is not null and public.stock_full_work_allowed(project_id));
drop policy if exists stock_full_runtime_exits_insert on public.stock_full_exits;
create policy stock_full_runtime_exits_insert on public.stock_full_exits for insert to authenticated
with check (institution_id = public.stock_full_current_institution_id() and project_id is not null and public.stock_full_work_allowed(project_id) and created_by = public.stock_full_current_profile_id());

drop policy if exists stock_full_runtime_audit_select on public.stock_full_audit_log;
create policy stock_full_runtime_audit_select on public.stock_full_audit_log for select to authenticated
using (institution_id = public.stock_full_current_institution_id() and project_id is not null and public.stock_full_work_allowed(project_id));
drop policy if exists stock_full_runtime_audit_insert on public.stock_full_audit_log;
create policy stock_full_runtime_audit_insert on public.stock_full_audit_log for insert to authenticated
with check (institution_id = public.stock_full_current_institution_id() and project_id is not null and public.stock_full_work_allowed(project_id) and created_by = public.stock_full_current_profile_id());
