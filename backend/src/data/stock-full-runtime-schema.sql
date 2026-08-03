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
  nfe_access_key text,
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
  add column if not exists synced_at timestamptz,
  add column if not exists nfe_access_key text;

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

create unique index if not exists stock_full_entries_nfe_access_key_idx
  on public.stock_full_entries(institution_id, nfe_access_key)
  where nfe_access_key is not null and btrim(nfe_access_key) <> '';

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

create or replace function public.confirm_stock_full_nfe_import(
  p_institution_id text,
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
begin
  if btrim(coalesce(p_institution_id, '')) = '' then
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
  where institution_id = p_institution_id
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
  where institution_id = p_institution_id
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
      p_institution_id,
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
      and institution_id = p_institution_id
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
    and institution_id = p_institution_id
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
    p_institution_id,
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
    p_institution_id,
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
    where institution_id = p_institution_id
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

revoke all on function public.confirm_stock_full_nfe_import(text, uuid, text, uuid, jsonb, jsonb) from public;
grant execute on function public.confirm_stock_full_nfe_import(text, uuid, text, uuid, jsonb, jsonb) to service_role;
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
