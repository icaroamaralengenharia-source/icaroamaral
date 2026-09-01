-- Apartment Handover trial invite links.
-- Migration separada: revisar antes de aplicar manualmente no Supabase.
-- Nao armazena token bruto; somente SHA-256 hex em token_hash.
-- Acesso direto de cliente a tabela: bloqueado por RLS e revokes explicitos.

do $$
declare
  v_exists boolean;
begin
  select exists (
    select 1
      from information_schema.tables
     where table_schema = 'public'
       and table_name = 'institution_module_invites'
  ) into v_exists;

  if not v_exists then
    create table public.institution_module_invites (
      id uuid primary key default gen_random_uuid(),
      institution_id uuid not null references public.institutions(id) on delete cascade,
      module_key text not null,
      token_hash text not null,
      status text not null default 'active',
      expires_at timestamptz not null,
      max_redemptions integer not null default 3,
      redeemed_count integer not null default 0,
      created_by uuid null,
      created_at timestamptz not null default now(),
      revoked_at timestamptz null,
      last_redeemed_at timestamptz null,
      constraint institution_module_invites_module_check check (module_key = 'apartment_handover'),
      constraint institution_module_invites_status_check check (status in ('active', 'revoked', 'expired')),
      constraint institution_module_invites_token_hash_check check (token_hash ~ '^[a-f0-9]{64}$'),
      constraint institution_module_invites_max_redemptions_check check (max_redemptions > 0),
      constraint institution_module_invites_redeemed_count_check check (redeemed_count >= 0 and redeemed_count <= max_redemptions)
    );
  else
    perform 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'institution_module_invites'
       and column_name = 'id'
       and data_type = 'uuid';
    if not found then raise exception 'institution_module_invites.id incompatible'; end if;

    perform 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'institution_module_invites'
       and column_name = 'institution_id'
       and data_type = 'uuid'
       and is_nullable = 'NO';
    if not found then raise exception 'institution_module_invites.institution_id incompatible'; end if;

    perform 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'institution_module_invites'
       and column_name = 'token_hash'
       and data_type = 'text'
       and is_nullable = 'NO';
    if not found then raise exception 'institution_module_invites.token_hash incompatible'; end if;

    perform 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'institution_module_invites'
       and column_name = 'expires_at'
       and data_type = 'timestamp with time zone'
       and is_nullable = 'NO';
    if not found then raise exception 'institution_module_invites.expires_at incompatible'; end if;

    perform 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'institution_module_invites'
       and column_name = 'max_redemptions'
       and data_type = 'integer'
       and is_nullable = 'NO';
    if not found then raise exception 'institution_module_invites.max_redemptions incompatible'; end if;

    perform 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'institution_module_invites'
       and column_name = 'redeemed_count'
       and data_type = 'integer'
       and is_nullable = 'NO';
    if not found then raise exception 'institution_module_invites.redeemed_count incompatible'; end if;
  end if;
end $$;


do $invite_constraints$
begin
  perform 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
   where n.nspname = 'public'
     and t.relname = 'institution_module_invites'
     and c.conname = 'institution_module_invites_module_check'
     and c.contype = 'c';
  if not found then raise exception 'institution_module_invites_module_check missing'; end if;

  perform 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
   where n.nspname = 'public'
     and t.relname = 'institution_module_invites'
     and c.conname = 'institution_module_invites_status_check'
     and c.contype = 'c';
  if not found then raise exception 'institution_module_invites_status_check missing'; end if;

  perform 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
   where n.nspname = 'public'
     and t.relname = 'institution_module_invites'
     and c.conname = 'institution_module_invites_token_hash_check'
     and c.contype = 'c';
  if not found then raise exception 'institution_module_invites_token_hash_check missing'; end if;

  perform 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
   where n.nspname = 'public'
     and t.relname = 'institution_module_invites'
     and c.conname = 'institution_module_invites_max_redemptions_check'
     and c.contype = 'c';
  if not found then raise exception 'institution_module_invites_max_redemptions_check missing'; end if;

  perform 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
   where n.nspname = 'public'
     and t.relname = 'institution_module_invites'
     and c.conname = 'institution_module_invites_redeemed_count_check'
     and c.contype = 'c';
  if not found then raise exception 'institution_module_invites_redeemed_count_check missing'; end if;
end
$invite_constraints$;

create unique index if not exists institution_module_invites_token_hash_uq
  on public.institution_module_invites (token_hash);

create index if not exists institution_module_invites_institution_module_idx
  on public.institution_module_invites (institution_id, module_key, status);

create index if not exists institution_module_invites_expires_at_idx
  on public.institution_module_invites (expires_at);

do $invite_indexes$
begin
  perform 1
    from pg_indexes
   where schemaname = 'public'
     and tablename = 'institution_module_invites'
     and indexname = 'institution_module_invites_token_hash_uq'
     and indexdef ilike '%unique%'
     and indexdef ilike '%token_hash%';
  if not found then raise exception 'institution_module_invites_token_hash_uq incompatible'; end if;
end
$invite_indexes$;

alter table public.institution_module_invites enable row level security;

revoke all on table public.institution_module_invites from public;
revoke all on table public.institution_module_invites from anon;
revoke all on table public.institution_module_invites from authenticated;

create or replace function public.redeem_institution_module_invite(
  p_token_hash text,
  p_module_key text default 'apartment_handover',
  p_now timestamptz default now()
)
returns table (
  id uuid,
  institution_id uuid,
  module_key text,
  status text,
  expires_at timestamptz,
  max_redemptions integer,
  redeemed_count integer,
  created_by uuid,
  created_at timestamptz,
  revoked_at timestamptz,
  last_redeemed_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invite public.institution_module_invites%rowtype;
begin
  select *
    into v_invite
    from public.institution_module_invites imi
   where imi.token_hash = p_token_hash
     and imi.module_key = p_module_key
   for update;

  if not found then
    raise exception 'invite_not_found' using errcode = 'P0001';
  end if;

  if v_invite.status = 'revoked' or v_invite.revoked_at is not null then
    raise exception 'invite_revoked' using errcode = 'P0001';
  end if;

  if v_invite.status = 'expired' or v_invite.expires_at <= p_now then
    update public.institution_module_invites
       set status = 'expired'
     where institution_module_invites.id = v_invite.id
       and institution_module_invites.status = 'active';
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;

  if v_invite.redeemed_count >= v_invite.max_redemptions then
    raise exception 'invite_max_redemptions_reached' using errcode = 'P0001';
  end if;

  update public.institution_module_invites
     set redeemed_count = redeemed_count + 1,
         last_redeemed_at = p_now
   where institution_module_invites.id = v_invite.id
     and institution_module_invites.status = 'active'
     and institution_module_invites.expires_at > p_now
     and institution_module_invites.redeemed_count < institution_module_invites.max_redemptions
   returning *
    into v_invite;

  if not found then
    raise exception 'invite_concurrent_redemption_failed' using errcode = 'P0001';
  end if;

  return query
  select
    v_invite.id,
    v_invite.institution_id,
    v_invite.module_key,
    v_invite.status,
    v_invite.expires_at,
    v_invite.max_redemptions,
    v_invite.redeemed_count,
    v_invite.created_by,
    v_invite.created_at,
    v_invite.revoked_at,
    v_invite.last_redeemed_at;
end;
$$;

revoke all on function public.redeem_institution_module_invite(text, text, timestamptz) from public;
revoke all on function public.redeem_institution_module_invite(text, text, timestamptz) from anon;
revoke all on function public.redeem_institution_module_invite(text, text, timestamptz) from authenticated;
grant execute on function public.redeem_institution_module_invite(text, text, timestamptz) to service_role;

comment on table public.institution_module_invites is
  'Convites opacos para iniciar sessoes curtas do modulo Vistoria de Entrega Apartment Handover trial.';

comment on column public.institution_module_invites.token_hash is
  'SHA-256 hex do token bruto. O token bruto nunca deve ser persistido.';
