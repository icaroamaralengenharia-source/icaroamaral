-- Stock Full NF-e final secure RPC for Supabase E2E/staging.
-- Apply manually only after confirming the target staging project.

drop function if exists public.confirm_stock_full_nfe_import(text, uuid, text, uuid, jsonb, jsonb);

create or replace function public.confirm_stock_full_nfe_import(
  p_institution_id uuid,
  p_profile_id uuid,
  p_nfe_access_key text,
  p_item_id uuid default null,
  p_product jsonb default null,
  p_movement jsonb default '{}'::jsonb
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
  v_now timestamptz := now();
  v_institution_id_text text := p_institution_id::text;
begin
  if p_institution_id is null then
    raise exception 'institution_id_required';
  end if;
  if btrim(coalesce(p_nfe_access_key, '')) = '' then
    raise exception 'nfe_access_key_required';
  end if;

  select * into v_profile
  from public.profiles
  where id = p_profile_id
    and institution_id = p_institution_id
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
    and (
      (v_offline_uuid <> '' and offline_uuid = v_offline_uuid)
      or (v_operation_id <> '' and operation_id = v_operation_id)
    )
  limit 1;
  if found then
    select * into v_item from public.stock_full_items where id = v_entry.item_id limit 1;
    return jsonb_build_object('status', 'duplicate', 'duplicate', true, 'entry', to_jsonb(v_entry), 'item', to_jsonb(v_item));
  end if;

  select * into v_entry
  from public.stock_full_entries
  where institution_id = v_institution_id_text
    and nfe_access_key = p_nfe_access_key
  limit 1;
  if found then
    select * into v_item from public.stock_full_items where id = v_entry.item_id limit 1;
    return jsonb_build_object('status', 'duplicate', 'duplicate', true, 'entry', to_jsonb(v_entry), 'item', to_jsonb(v_item));
  end if;

  if p_item_id is null then
    if p_product is null then
      raise exception 'stock_full_item_required';
    end if;
    insert into public.stock_full_items (
      institution_id,
      name,
      unit,
      category,
      min_quantity,
      current_quantity,
      location,
      notes,
      is_active,
      created_by,
      created_at,
      updated_at
    ) values (
      v_institution_id_text,
      btrim(coalesce(p_product ->> 'name', '')),
      coalesce(nullif(btrim(coalesce(p_product ->> 'unit', '')), ''), 'un'),
      coalesce(nullif(btrim(coalesce(p_product ->> 'category', '')), ''), 'Geral'),
      coalesce(nullif(p_product ->> 'min_quantity', '')::numeric, 0),
      0,
      btrim(coalesce(p_product ->> 'location', '')),
      btrim(coalesce(p_product ->> 'notes', '')),
      true,
      p_profile_id,
      v_now,
      v_now
    ) returning * into v_item;
  else
    select * into v_item
    from public.stock_full_items
    where id = p_item_id
      and institution_id = v_institution_id_text
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
  set current_quantity = v_next_balance,
      updated_at = v_now
  where id = v_item.id
    and institution_id = v_institution_id_text
    and is_active = true
  returning * into v_item;

  insert into public.stock_full_entries (
    institution_id,
    offline_uuid,
    operation_id,
    device_id,
    sync_status,
    source,
    synced_at,
    item_id,
    quantity,
    unit_cost,
    supplier,
    invoice_number,
    nfe_access_key,
    notes,
    created_by,
    created_at
  ) values (
    v_institution_id_text,
    nullif(v_offline_uuid, ''),
    nullif(v_operation_id, ''),
    nullif(btrim(coalesce(p_movement ->> 'device_id', '')), ''),
    coalesce(nullif(btrim(coalesce(p_movement ->> 'sync_status', '')), ''), 'synced'),
    coalesce(nullif(btrim(coalesce(p_movement ->> 'source', '')), ''), 'online'),
    v_now,
    v_item.id,
    v_quantity,
    v_unit_cost,
    btrim(coalesce(p_movement ->> 'supplier', '')),
    btrim(coalesce(p_movement ->> 'invoice_number', p_nfe_access_key)),
    p_nfe_access_key,
    btrim(coalesce(p_movement ->> 'notes', '')),
    p_profile_id,
    v_now
  ) returning * into v_entry;

  insert into public.stock_full_audit_log (
    institution_id,
    action,
    entity_type,
    entity_id,
    product_id,
    before_data,
    after_data,
    device_id,
    offline_uuid,
    operation_id,
    source,
    description,
    created_by,
    created_at
  ) values (
    v_institution_id_text,
    'stock_full_nfe_imported',
    'stock_full_entry',
    v_entry.id,
    v_item.id,
    jsonb_build_object('current_quantity', v_previous_balance),
    jsonb_build_object('current_quantity', v_next_balance, 'quantity', v_quantity, 'nfe_access_key', p_nfe_access_key),
    nullif(btrim(coalesce(p_movement ->> 'device_id', '')), ''),
    nullif(v_offline_uuid, ''),
    nullif(v_operation_id, ''),
    coalesce(nullif(btrim(coalesce(p_movement ->> 'source', '')), ''), 'online'),
    'NF-e importada no Stock Full.',
    p_profile_id,
    v_now
  ) returning * into v_audit;

  return jsonb_build_object('status', 'synced', 'duplicate', false, 'entry', to_jsonb(v_entry), 'item', to_jsonb(v_item), 'audit', to_jsonb(v_audit));
exception
  when unique_violation then
    select * into v_entry
    from public.stock_full_entries
    where institution_id = v_institution_id_text
      and (
        nfe_access_key = p_nfe_access_key
        or (v_offline_uuid <> '' and offline_uuid = v_offline_uuid)
        or (v_operation_id <> '' and operation_id = v_operation_id)
      )
    limit 1;
    if found then
      select * into v_item from public.stock_full_items where id = v_entry.item_id limit 1;
      return jsonb_build_object('status', 'duplicate', 'duplicate', true, 'entry', to_jsonb(v_entry), 'item', to_jsonb(v_item));
    end if;
    raise;
end;
$$;

revoke all on function public.confirm_stock_full_nfe_import(uuid, uuid, text, uuid, jsonb, jsonb) from public;
revoke all on function public.confirm_stock_full_nfe_import(uuid, uuid, text, uuid, jsonb, jsonb) from anon;
revoke all on function public.confirm_stock_full_nfe_import(uuid, uuid, text, uuid, jsonb, jsonb) from authenticated;
grant execute on function public.confirm_stock_full_nfe_import(uuid, uuid, text, uuid, jsonb, jsonb) to service_role;
