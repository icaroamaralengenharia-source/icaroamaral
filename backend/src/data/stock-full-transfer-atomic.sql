-- Stock Full atomic transfer core.
-- Prepared locally only. Do not apply without backup, staging audit, and rollback plan.

-- Transfer support keeps entry and exit linked by the same stable transfer_id.
alter table if exists public.stock_full_entries
  add column if not exists transfer_id text;

alter table if exists public.stock_full_exits
  add column if not exists transfer_id text;

-- Preflight: stop before creating transfer unique indexes if current data is dirty.
do $$
declare
  v_entries_duplicates integer;
  v_exits_duplicates integer;
begin
  select count(*) into v_entries_duplicates
  from (
    select institution_id, transfer_id
    from public.stock_full_entries
    where transfer_id is not null and btrim(transfer_id) <> ''
    group by institution_id, transfer_id
    having count(*) > 1
  ) duplicates;

  if v_entries_duplicates > 0 then
    raise exception 'stock_full_entries_transfer_id_duplicates_found: %', v_entries_duplicates;
  end if;

  select count(*) into v_exits_duplicates
  from (
    select institution_id, transfer_id
    from public.stock_full_exits
    where transfer_id is not null and btrim(transfer_id) <> ''
    group by institution_id, transfer_id
    having count(*) > 1
  ) duplicates;

  if v_exits_duplicates > 0 then
    raise exception 'stock_full_exits_transfer_id_duplicates_found: %', v_exits_duplicates;
  end if;
end;
$$;

create unique index if not exists stock_full_entries_transfer_id_idx
  on public.stock_full_entries(institution_id, transfer_id)
  where transfer_id is not null and btrim(transfer_id) <> '';

create unique index if not exists stock_full_exits_transfer_id_idx
  on public.stock_full_exits(institution_id, transfer_id)
  where transfer_id is not null and btrim(transfer_id) <> '';

create or replace function public.stock_full_apply_transfer(
  p_profile_id uuid,
  p_transfer jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_source_item public.stock_full_items%rowtype;
  v_destination_item public.stock_full_items%rowtype;
  v_updated_source_item public.stock_full_items%rowtype;
  v_updated_destination_item public.stock_full_items%rowtype;
  v_entry public.stock_full_entries%rowtype;
  v_exit public.stock_full_exits%rowtype;
  v_duplicate_entry public.stock_full_entries%rowtype;
  v_duplicate_exit public.stock_full_exits%rowtype;
  v_audit public.stock_full_audit_log%rowtype;
  v_transfer_id text;
  v_source_item_id uuid;
  v_destination_item_id uuid;
  v_quantity numeric;
  v_source_previous_balance numeric;
  v_source_next_balance numeric;
  v_destination_previous_balance numeric;
  v_destination_next_balance numeric;
  v_device_id text;
  v_source text;
  v_responsible text;
  v_notes text;
  v_now timestamptz := now();
begin
  if p_profile_id is null then
    raise exception 'stock_full_profile_not_found';
  end if;

  select * into v_profile
  from public.profiles
  where id = p_profile_id
  limit 1;

  if not found then
    raise exception 'stock_full_profile_not_found';
  end if;

  if lower(coalesce(v_profile.role, '')) not in ('admin', 'gestor', 'funcionario', 'operador', 'estoquista') then
    raise exception 'permission_denied';
  end if;

  v_transfer_id := btrim(coalesce(p_transfer ->> 'transfer_id', p_transfer ->> 'transferId', p_transfer ->> 'operation_id', p_transfer ->> 'operationId', ''));
  if v_transfer_id = '' then
    raise exception 'transfer_id_required';
  end if;

  begin
    v_source_item_id := nullif(btrim(coalesce(p_transfer ->> 'source_item_id', p_transfer ->> 'sourceItemId', '')), '')::uuid;
  exception
    when invalid_text_representation then
      raise exception 'source_item_id_required';
  end;
  if v_source_item_id is null then
    raise exception 'source_item_id_required';
  end if;

  begin
    v_destination_item_id := nullif(btrim(coalesce(p_transfer ->> 'destination_item_id', p_transfer ->> 'destinationItemId', '')), '')::uuid;
  exception
    when invalid_text_representation then
      raise exception 'destination_item_id_required';
  end;
  if v_destination_item_id is null then
    raise exception 'destination_item_id_required';
  end if;

  if v_source_item_id = v_destination_item_id then
    raise exception 'stock_full_same_transfer_item';
  end if;

  begin
    v_quantity := nullif(btrim(coalesce(p_transfer ->> 'quantity', '')), '')::numeric;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'quantity_required';
  end;
  if v_quantity is null or v_quantity <= 0 or v_quantity::text = 'NaN' then
    raise exception 'quantity_required';
  end if;

  select * into v_duplicate_exit
  from public.stock_full_exits
  where institution_id = v_profile.institution_id::text
    and transfer_id = v_transfer_id
  limit 1;

  select * into v_duplicate_entry
  from public.stock_full_entries
  where institution_id = v_profile.institution_id::text
    and transfer_id = v_transfer_id
  limit 1;

  if v_duplicate_exit.id is not null and v_duplicate_entry.id is not null then
    select * into v_source_item from public.stock_full_items where id = v_duplicate_exit.item_id limit 1;
    select * into v_destination_item from public.stock_full_items where id = v_duplicate_entry.item_id limit 1;
    return jsonb_build_object(
      'status', 'duplicate',
      'duplicate', true,
      'transfer_id', v_transfer_id,
      'exit', to_jsonb(v_duplicate_exit),
      'entry', to_jsonb(v_duplicate_entry),
      'sourceItem', to_jsonb(v_source_item),
      'destinationItem', to_jsonb(v_destination_item)
    );
  end if;

  if v_duplicate_exit.id is not null or v_duplicate_entry.id is not null then
    raise exception 'stock_full_transfer_partial_state';
  end if;

  select * into v_source_item
  from public.stock_full_items
  where id = v_source_item_id
    and institution_id = v_profile.institution_id::text
    and is_active = true
  for update;

  if not found then
    raise exception 'stock_full_item_not_found';
  end if;

  select * into v_destination_item
  from public.stock_full_items
  where id = v_destination_item_id
    and institution_id = v_profile.institution_id::text
    and is_active = true
  for update;

  if not found then
    raise exception 'stock_full_destination_item_not_found';
  end if;

  v_source_previous_balance := coalesce(v_source_item.current_quantity, 0);
  v_destination_previous_balance := coalesce(v_destination_item.current_quantity, 0);

  if v_quantity > v_source_previous_balance then
    raise exception 'stock_full_insufficient_quantity';
  end if;

  v_source_next_balance := v_source_previous_balance - v_quantity;
  v_destination_next_balance := v_destination_previous_balance + v_quantity;
  v_device_id := nullif(btrim(coalesce(p_transfer ->> 'device_id', p_transfer ->> 'deviceId', '')), '');
  v_source := coalesce(nullif(btrim(coalesce(p_transfer ->> 'source', '')), ''), 'elo');
  v_responsible := btrim(coalesce(p_transfer ->> 'responsible', ''));
  v_notes := btrim(coalesce(p_transfer ->> 'notes', ''));

  update public.stock_full_items
  set current_quantity = v_source_next_balance,
      updated_at = v_now
  where id = v_source_item.id
    and institution_id = v_profile.institution_id::text
    and is_active = true
  returning * into v_updated_source_item;

  update public.stock_full_items
  set current_quantity = v_destination_next_balance,
      updated_at = v_now
  where id = v_destination_item.id
    and institution_id = v_profile.institution_id::text
    and is_active = true
  returning * into v_updated_destination_item;

  insert into public.stock_full_exits (
    institution_id, offline_uuid, operation_id, transfer_id, device_id, sync_status, source, synced_at,
    item_id, quantity, destination, responsible, notes, created_by, created_at
  ) values (
    v_profile.institution_id::text,
    v_transfer_id,
    v_transfer_id,
    v_transfer_id,
    v_device_id,
    'synced',
    v_source,
    v_now,
    v_source_item.id,
    v_quantity,
    coalesce(nullif(btrim(coalesce(p_transfer ->> 'destination_label', p_transfer ->> 'destinationLabel', '')), ''), v_destination_item.name),
    v_responsible,
    v_notes,
    v_profile.id,
    v_now
  ) returning * into v_exit;

  insert into public.stock_full_entries (
    institution_id, offline_uuid, operation_id, transfer_id, device_id, sync_status, source, synced_at,
    item_id, quantity, supplier, notes, created_by, created_at
  ) values (
    v_profile.institution_id::text,
    v_transfer_id,
    v_transfer_id,
    v_transfer_id,
    v_device_id,
    'synced',
    v_source,
    v_now,
    v_destination_item.id,
    v_quantity,
    coalesce(nullif(btrim(coalesce(p_transfer ->> 'source_label', p_transfer ->> 'sourceLabel', '')), ''), v_source_item.name),
    v_notes,
    v_profile.id,
    v_now
  ) returning * into v_entry;

  insert into public.stock_full_audit_log (
    institution_id, action, entity_type, product_id, before_data, after_data,
    device_id, offline_uuid, operation_id, source, description, created_by, created_at
  ) values (
    v_profile.institution_id::text,
    'stock_full_transfer_created',
    'stock_full_transfer',
    v_source_item.id,
    jsonb_build_object(
      'source_item_id', v_source_item.id,
      'destination_item_id', v_destination_item.id,
      'source_quantity', v_source_previous_balance,
      'destination_quantity', v_destination_previous_balance
    ),
    jsonb_build_object(
      'transfer_id', v_transfer_id,
      'quantity', v_quantity,
      'source_item_id', v_source_item.id,
      'destination_item_id', v_destination_item.id,
      'source_quantity', v_source_next_balance,
      'destination_quantity', v_destination_next_balance,
      'exit_id', v_exit.id,
      'entry_id', v_entry.id
    ),
    v_device_id,
    v_transfer_id,
    v_transfer_id,
    v_source,
    'Transferencia registrada no Stock Full.',
    v_profile.id,
    v_now
  ) returning * into v_audit;

  return jsonb_build_object(
    'status', 'synced',
    'duplicate', false,
    'transfer_id', v_transfer_id,
    'exit', to_jsonb(v_exit),
    'entry', to_jsonb(v_entry),
    'sourceItem', to_jsonb(v_updated_source_item),
    'destinationItem', to_jsonb(v_updated_destination_item),
    'audit', to_jsonb(v_audit),
    'sourcePreviousBalance', v_source_previous_balance,
    'sourceNewBalance', v_source_next_balance,
    'destinationPreviousBalance', v_destination_previous_balance,
    'destinationNewBalance', v_destination_next_balance
  );
exception
  when unique_violation then
    select * into v_duplicate_exit
    from public.stock_full_exits
    where institution_id = v_profile.institution_id::text
      and transfer_id = v_transfer_id
    limit 1;

    select * into v_duplicate_entry
    from public.stock_full_entries
    where institution_id = v_profile.institution_id::text
      and transfer_id = v_transfer_id
    limit 1;

    if v_duplicate_exit.id is not null and v_duplicate_entry.id is not null then
      select * into v_source_item from public.stock_full_items where id = v_duplicate_exit.item_id limit 1;
      select * into v_destination_item from public.stock_full_items where id = v_duplicate_entry.item_id limit 1;
      return jsonb_build_object(
        'status', 'duplicate',
        'duplicate', true,
        'transfer_id', v_transfer_id,
        'exit', to_jsonb(v_duplicate_exit),
        'entry', to_jsonb(v_duplicate_entry),
        'sourceItem', to_jsonb(v_source_item),
        'destinationItem', to_jsonb(v_destination_item)
      );
    end if;
    raise exception 'stock_full_transfer_partial_state';
end;
$$;

revoke all on function public.stock_full_apply_transfer(uuid, jsonb) from public;
revoke all on function public.stock_full_apply_transfer(uuid, jsonb) from anon;
revoke all on function public.stock_full_apply_transfer(uuid, jsonb) from authenticated;
grant execute on function public.stock_full_apply_transfer(uuid, jsonb) to service_role;