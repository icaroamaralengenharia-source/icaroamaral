-- Make a Stock Full movement, balance update, and audit row one transaction.
-- Run once in the Supabase SQL editor before deploying the backend change.
-- Authenticated execution under the caller's JWT; this migration does not alter RLS.

do $$
begin
  if to_regclass('public.stock_full_items') is null
    or to_regclass('public.stock_full_entries') is null
    or to_regclass('public.stock_full_exits') is null
    or to_regclass('public.stock_full_audit_log') is null then
    raise exception 'stock_full_runtime_schema_required';
  end if;
  if to_regprocedure('public.stock_full_current_institution_id()') is null
    or to_regprocedure('public.stock_full_work_allowed(text)') is null then
    raise exception 'stock_full_work_scope_migration_required';
  end if;
end;
$$;

create or replace function public.stock_full_apply_movement(
  p_institution_id text,
  p_profile_id uuid,
  p_project_id text,
  p_item_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_movement jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_item public.stock_full_items%rowtype;
  v_entry public.stock_full_entries%rowtype;
  v_exit public.stock_full_exits%rowtype;
  v_existing_item public.stock_full_items%rowtype;
  v_previous_balance numeric;
  v_next_balance numeric;
  v_operation_id text;
  v_offline_uuid text;
  v_request_id text;
  v_source text;
  v_sync_status text;
  v_now timestamptz := now();
  v_existing_type text;
  v_existing_movement_id uuid;
  v_existing_item_id uuid;
  v_existing_project_id text;
  v_existing_quantity numeric;
  v_existing_count integer;
  v_lock_key text;
  v_result jsonb;
  v_nfe_access_key text;
  v_project_id text := nullif(btrim(p_project_id), '');
begin
  if p_institution_id is null or btrim(p_institution_id) = '' then
    raise exception 'institution_id_required';
  end if;
  if p_institution_id is distinct from public.stock_full_current_institution_id() then
    raise exception 'stock_full_institution_not_allowed';
  end if;
  if v_project_id is not null and not public.stock_full_work_allowed(v_project_id) then
    raise exception 'WORK_NOT_ALLOWED';
  end if;
  if p_movement_type is null or p_movement_type not in ('entrada', 'saida') then
    raise exception 'stock_full_movement_type_invalid';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity_required';
  end if;

  select * into v_profile
  from public.profiles
  where id = p_profile_id
    and institution_id::text = p_institution_id
    and auth_user_id = auth.uid()
  limit 1;
  if not found then
    raise exception 'stock_full_profile_not_found';
  end if;
  if lower(coalesce(v_profile.role, '')) in ('leitura', 'viewer', 'read_only') then
    raise exception 'permission_denied';
  end if;

  v_operation_id := nullif(btrim(coalesce(p_movement ->> 'operation_id', '')), '');
  v_offline_uuid := nullif(btrim(coalesce(p_movement ->> 'offline_uuid', '')), '');
  v_nfe_access_key := nullif(btrim(coalesce(p_movement ->> 'nfe_access_key', '')), '');
  v_request_id := coalesce(v_operation_id, v_offline_uuid);
  if v_request_id is null then
    raise exception 'stock_full_request_id_required';
  end if;
  v_source := coalesce(nullif(btrim(coalesce(p_movement ->> 'source', '')), ''), 'online');
  v_sync_status := coalesce(nullif(btrim(coalesce(p_movement ->> 'sync_status', '')), ''), 'synced');

  -- Lock both idempotency keys in a stable order, including cross-table retries.
  for v_lock_key in
    select distinct keys.value
    from unnest(array[
      v_operation_id,
      v_offline_uuid,
      case when p_movement_type = 'entrada' then v_nfe_access_key else null end
    ]) as keys(value)
    where keys.value is not null
    order by keys.value
  loop
    perform pg_advisory_xact_lock(hashtextextended(p_institution_id || ':' || v_lock_key, 0));
  end loop;

  select count(*) into v_existing_count
  from (
    select id
    from public.stock_full_entries
    where institution_id = p_institution_id
      and ((v_offline_uuid is not null and offline_uuid = v_offline_uuid)
        or (v_operation_id is not null and operation_id = v_operation_id))
    union all
    select id
    from public.stock_full_exits
    where institution_id = p_institution_id
      and ((v_offline_uuid is not null and offline_uuid = v_offline_uuid)
        or (v_operation_id is not null and operation_id = v_operation_id))
  ) as matching_movements;

  if v_existing_count > 1 then
    raise exception 'stock_full_idempotency_key_reused';
  end if;

  if v_existing_count = 1 then
    select match.movement_type, match.id, match.item_id, match.project_id, match.quantity
    into v_existing_type, v_existing_movement_id, v_existing_item_id, v_existing_project_id, v_existing_quantity
    from (
      select 'entrada'::text as movement_type, id, item_id, project_id, quantity
      from public.stock_full_entries
      where institution_id = p_institution_id
        and ((v_offline_uuid is not null and offline_uuid = v_offline_uuid)
          or (v_operation_id is not null and operation_id = v_operation_id))
      union all
      select 'saida'::text as movement_type, id, item_id, project_id, quantity
      from public.stock_full_exits
      where institution_id = p_institution_id
        and ((v_offline_uuid is not null and offline_uuid = v_offline_uuid)
          or (v_operation_id is not null and operation_id = v_operation_id))
    ) as match
    limit 1;

    if v_existing_type <> p_movement_type
      or v_existing_item_id is distinct from p_item_id
      or v_existing_project_id is distinct from v_project_id
      or v_existing_quantity is distinct from p_quantity then
      raise exception 'stock_full_idempotency_key_reused';
    end if;
    select * into v_existing_item
    from public.stock_full_items
    where id = v_existing_item_id
      and institution_id = p_institution_id
      and project_id is not distinct from v_project_id
    limit 1;
    if p_movement_type = 'entrada' then
      select * into v_entry from public.stock_full_entries where id = v_existing_movement_id;
      return jsonb_build_object('status', 'duplicate', 'duplicate', true, 'entry', to_jsonb(v_entry), 'item', to_jsonb(v_existing_item));
    end if;
    select * into v_exit from public.stock_full_exits where id = v_existing_movement_id;
    return jsonb_build_object('status', 'duplicate', 'duplicate', true, 'exit', to_jsonb(v_exit), 'item', to_jsonb(v_existing_item));
  end if;

  if p_movement_type = 'entrada' and v_nfe_access_key is not null and exists (
    select 1
    from public.stock_full_entries
    where institution_id = p_institution_id
      and nfe_access_key = v_nfe_access_key
  ) then
    raise exception 'stock_full_nfe_already_imported';
  end if;

  select * into v_item
  from public.stock_full_items
  where id = p_item_id
    and institution_id = p_institution_id
    and project_id is not distinct from v_project_id
    and is_active = true
  for update;
  if not found then
    raise exception 'stock_full_item_not_found';
  end if;

  v_previous_balance := coalesce(v_item.current_quantity, 0);
  if p_movement_type = 'saida' and p_quantity > v_previous_balance then
    raise exception 'stock_full_insufficient_quantity';
  end if;
  v_next_balance := case
    when p_movement_type = 'saida' then v_previous_balance - p_quantity
    else v_previous_balance + p_quantity
  end;

  update public.stock_full_items
  set current_quantity = v_next_balance,
      updated_at = v_now
  where id = v_item.id
    and institution_id = p_institution_id
    and project_id is not distinct from v_project_id
    and is_active = true
  returning * into v_item;
  if not found then
    raise exception 'stock_full_item_not_found';
  end if;

  if p_movement_type = 'entrada' then
    insert into public.stock_full_entries (
      institution_id, project_id, offline_uuid, operation_id, device_id,
      sync_status, source, synced_at, item_id, quantity, unit_cost,
      supplier, invoice_number, nfe_access_key, notes, created_by
    ) values (
      p_institution_id, v_project_id, v_offline_uuid, v_operation_id,
      nullif(btrim(coalesce(p_movement ->> 'device_id', '')), ''),
      v_sync_status, v_source,
      nullif(p_movement ->> 'synced_at', '')::timestamptz,
      p_item_id, p_quantity,
      nullif(p_movement ->> 'unit_cost', '')::numeric,
      nullif(btrim(coalesce(p_movement ->> 'supplier', '')), ''),
      nullif(btrim(coalesce(p_movement ->> 'invoice_number', '')), ''),
      v_nfe_access_key,
      nullif(btrim(coalesce(p_movement ->> 'notes', '')), ''),
      p_profile_id
    ) returning * into v_entry;

    insert into public.stock_full_audit_log (
      institution_id, project_id, action, entity_type, entity_id, product_id,
      before_data, after_data, device_id, offline_uuid, operation_id, source,
      description, created_by, created_at
    ) values (
      p_institution_id, v_project_id,
      case when v_source = 'offline' then 'stock_full_offline_sync_completed' else 'stock_full_entry_created' end,
      'stock_full_entry', v_entry.id, p_item_id,
      jsonb_build_object('current_quantity', v_previous_balance),
      jsonb_build_object('current_quantity', v_next_balance, 'quantity', p_quantity, 'type', p_movement_type),
      nullif(btrim(coalesce(p_movement ->> 'device_id', '')), ''),
      v_offline_uuid, v_operation_id, v_source,
      case when v_source = 'offline' then 'Movimento offline sincronizado no Stock Full.' else 'Entrada registrada para ' || coalesce(v_item.name, 'produto') || '.' end,
      p_profile_id, v_now
    );
    v_result := jsonb_build_object('status', case when v_source = 'offline' then 'synced' else 'created' end, 'duplicate', false, 'previousBalance', v_previous_balance, 'newBalance', v_next_balance, 'entry', to_jsonb(v_entry), 'item', to_jsonb(v_item));
    return v_result;
  end if;

  insert into public.stock_full_exits (
    institution_id, project_id, offline_uuid, operation_id, device_id,
    sync_status, source, synced_at, item_id, quantity, destination,
    responsible, notes, created_by
  ) values (
    p_institution_id, v_project_id, v_offline_uuid, v_operation_id,
    nullif(btrim(coalesce(p_movement ->> 'device_id', '')), ''),
    v_sync_status, v_source,
    nullif(p_movement ->> 'synced_at', '')::timestamptz,
    p_item_id, p_quantity,
    nullif(btrim(coalesce(p_movement ->> 'destination', '')), ''),
    nullif(btrim(coalesce(p_movement ->> 'responsible', '')), ''),
    nullif(btrim(coalesce(p_movement ->> 'notes', '')), ''),
    p_profile_id
  ) returning * into v_exit;

  insert into public.stock_full_audit_log (
    institution_id, project_id, action, entity_type, entity_id, product_id,
    before_data, after_data, device_id, offline_uuid, operation_id, source,
    description, created_by, created_at
  ) values (
    p_institution_id, v_project_id,
    case when v_source = 'offline' then 'stock_full_offline_sync_completed' else 'stock_full_exit_created' end,
    'stock_full_exit', v_exit.id, p_item_id,
    jsonb_build_object('current_quantity', v_previous_balance),
    jsonb_build_object('current_quantity', v_next_balance, 'quantity', p_quantity, 'type', p_movement_type),
    nullif(btrim(coalesce(p_movement ->> 'device_id', '')), ''),
    v_offline_uuid, v_operation_id, v_source,
    case when v_source = 'offline' then 'Movimento offline sincronizado no Stock Full.' else 'Saida registrada para ' || coalesce(v_item.name, 'produto') || ': ' || p_quantity::text || ' ' || coalesce(v_item.unit, 'un') || '.' end,
    p_profile_id, v_now
  );
  v_result := jsonb_build_object('status', case when v_source = 'offline' then 'synced' else 'created' end, 'duplicate', false, 'previousBalance', v_previous_balance, 'newBalance', v_next_balance, 'exit', to_jsonb(v_exit), 'item', to_jsonb(v_item));
  return v_result;
end;
$$;

revoke all on function public.stock_full_apply_movement(text, uuid, text, uuid, text, numeric, jsonb) from public;
revoke all on function public.stock_full_apply_movement(text, uuid, text, uuid, text, numeric, jsonb) from anon;
grant execute on function public.stock_full_apply_movement(text, uuid, text, uuid, text, numeric, jsonb) to authenticated;
