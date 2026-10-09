-- Canonical authenticated work creation for Stock Full.
-- Apply through the E2E Supabase migration/SQL deployment flow.
-- This function creates only public.obrareport_projects rows. It does not
-- weaken table RLS or grant direct table writes.

create or replace function public.stock_full_create_work(
  p_work_id text,
  p_client_id text,
  p_name text,
  p_address text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_institution_id text;
  v_role text;
  v_work_id text := btrim(coalesce(p_work_id, ''));
  v_client_id text := nullif(btrim(coalesce(p_client_id, '')), '');
  v_name text := btrim(coalesce(p_name, ''));
  v_address text := nullif(btrim(coalesce(p_address, '')), '');
  v_existing public.obrareport_projects%rowtype;
  v_created public.obrareport_projects%rowtype;
begin
  if v_auth_user_id is null then
    raise exception using errcode = '28000', message = 'authentication_required';
  end if;

  select p.institution_id, lower(btrim(coalesce(p.role, '')))
    into v_institution_id, v_role
  from public.profiles p
  where p.auth_user_id = v_auth_user_id
  order by p.created_at desc nulls last
  limit 1;

  if nullif(btrim(coalesce(v_institution_id, '')), '') is null then
    raise exception using errcode = 'P0002', message = 'stock_full_profile_not_found';
  end if;
  if v_role is null or v_role not in ('admin', 'administrador', 'gestor', 'patrao') then
    raise exception using errcode = '42501', message = 'permission_denied';
  end if;
  if v_work_id !~ '^obraproj_[0-9a-f]{64}$'
    or v_name = ''
    or length(v_name) > 160
    or v_name ~ '[[:cntrl:]]'
    or (v_address is not null and (length(v_address) > 500 or v_address ~ '[[:cntrl:]]')) then
    raise exception using errcode = '22023', message = 'stock_full_work_payload_invalid';
  end if;

  if v_client_id is not null and not exists (
    select 1
    from public.obrareport_clients c
    where c.id = v_client_id
      and c.institution_id = v_institution_id
  ) then
    raise exception using errcode = 'P0002', message = 'stock_full_work_client_not_found';
  end if;

  -- Serialize retries with the same idempotency-derived ID.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_institution_id),
    pg_catalog.hashtext('stock-full-work-id:' || v_work_id)
  );

  select p.*
    into v_existing
  from public.obrareport_projects p
  where p.id = v_work_id
    and p.institution_id = v_institution_id;

  if found then
    if v_existing.client_id is not distinct from v_client_id
      and v_existing.name = v_name
      and v_existing.address is not distinct from v_address then
      return jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'work', jsonb_build_object(
          'id', v_existing.id,
          'institution_id', v_existing.institution_id,
          'client_id', v_existing.client_id,
          'name', v_existing.name,
          'address', v_existing.address
        )
      );
    end if;
    raise exception using errcode = '23505', message = 'stock_full_work_idempotency_conflict';
  end if;

  -- Serialize exact-name duplicate checks inside tenant/client scope.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_institution_id),
    pg_catalog.hashtext('stock-full-work-name:' || coalesce(v_client_id, '<null>') || ':' || lower(v_name))
  );

  if exists (
    select 1
    from public.obrareport_projects p
    where p.institution_id = v_institution_id
      and p.client_id is not distinct from v_client_id
      and lower(btrim(p.name)) = lower(v_name)
  ) then
    raise exception using errcode = '23505', message = 'stock_full_work_duplicate';
  end if;

  insert into public.obrareport_projects (id, institution_id, client_id, name, address)
  values (v_work_id, v_institution_id, v_client_id, v_name, v_address)
  returning * into v_created;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'work', jsonb_build_object(
      'id', v_created.id,
      'institution_id', v_created.institution_id,
      'client_id', v_created.client_id,
      'name', v_created.name,
      'address', v_created.address
    )
  );
end;
$$;

revoke all on function public.stock_full_create_work(text, text, text, text) from public;
revoke all on function public.stock_full_create_work(text, text, text, text) from anon;
grant execute on function public.stock_full_create_work(text, text, text, text) to authenticated;
