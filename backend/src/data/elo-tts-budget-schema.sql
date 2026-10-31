-- Shared estimated USD per user/UTC calendar month, across all TTS usages.
-- document_id = '' is the shared bucket; nonempty IDs are audiobook only.
-- First installation only: unexpected existing objects must stop migration.
create table public.elo_tts_budget_buckets (
  user_id uuid not null references auth.users(id) on delete cascade,
  month_start date not null,
  document_id text not null default '',
  spent_usd numeric(14,6) not null default 0 check (spent_usd >= 0 and spent_usd < 100000000),
  reserved_usd numeric(14,6) not null default 0 check (reserved_usd >= 0 and reserved_usd < 100000000),
  updated_at timestamptz not null default now(),
  primary key (user_id, month_start, document_id)
);

create table public.elo_tts_budget_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_key text not null check (request_key ~ '^[a-f0-9]{64}$'),
  usage text not null check (usage in ('conversation', 'audiobook')),
  document_id text not null default '',
  estimate_usd numeric(14,6) not null check (estimate_usd > 0 and estimate_usd < 100000000),
  status text not null check (status in ('reserved', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  primary key (user_id, request_key),
  check ((usage = 'conversation' and document_id = '') or
         (usage = 'audiobook' and document_id ~ '^[A-Za-z0-9_.:-]{1,128}$'))
);

alter table public.elo_tts_budget_buckets enable row level security;
alter table public.elo_tts_budget_requests enable row level security;
revoke all on public.elo_tts_budget_buckets, public.elo_tts_budget_requests from public, anon, authenticated, service_role;
grant select, insert, update on public.elo_tts_budget_buckets, public.elo_tts_budget_requests to service_role;

create function public.elo_tts_reserve(
  p_user_id uuid,
  p_usage text,
  p_document_id text,
  p_request_key text,
  p_estimate_usd numeric,
  p_user_limit_usd numeric,
  p_document_limit_usd numeric
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', timezone('utc', now()))::date;
  v_document text := case when p_usage = 'audiobook' then coalesce(p_document_id, '') else '' end;
  v_user_spent numeric(14,6);
  v_user_reserved numeric(14,6);
  v_document_spent numeric(14,6);
  v_document_reserved numeric(14,6);
  v_inserted integer;
begin
  if p_user_id is null or p_usage is null or p_usage not in ('conversation', 'audiobook')
     or p_request_key is null or p_request_key !~ '^[a-f0-9]{64}$'
     or p_estimate_usd is null or not (p_estimate_usd > 0 and p_estimate_usd < 100000000)
     or p_estimate_usd <> round(p_estimate_usd, 6)
     or p_user_limit_usd is null or not (p_user_limit_usd > 0 and p_user_limit_usd < 100000000)
     or (p_usage = 'audiobook' and (v_document !~ '^[A-Za-z0-9_.:-]{1,128}$'
         or p_document_limit_usd is null or not (p_document_limit_usd > 0 and p_document_limit_usd < 100000000))) then
    raise exception 'tts_budget_request_invalid' using errcode = '22023';
  end if;

  -- Lock the SAME user/month row first, irrespective of usage/document.
  -- Settlement follows this order too. No provider call occurs in this RPC.
  insert into public.elo_tts_budget_buckets(user_id, month_start, document_id)
  values (p_user_id, v_month, '') on conflict do nothing;
  select spent_usd, reserved_usd into strict v_user_spent, v_user_reserved
  from public.elo_tts_budget_buckets
  where user_id = p_user_id and month_start = v_month and document_id = ''
  for update;

  if exists (select 1 from public.elo_tts_budget_requests
             where user_id = p_user_id and request_key = p_request_key) then
    return jsonb_build_object('reserved', false, 'reason', 'duplicate');
  end if;
  if v_user_spent + v_user_reserved + p_estimate_usd > p_user_limit_usd then
    return jsonb_build_object('reserved', false, 'reason', 'budget');
  end if;

  if p_usage = 'audiobook' then
    insert into public.elo_tts_budget_buckets(user_id, month_start, document_id)
    values (p_user_id, v_month, v_document) on conflict do nothing;
    select spent_usd, reserved_usd into strict v_document_spent, v_document_reserved
    from public.elo_tts_budget_buckets
    where user_id = p_user_id and month_start = v_month and document_id = v_document
    for update;
    if v_document_spent + v_document_reserved + p_estimate_usd > p_document_limit_usd then
      return jsonb_build_object('reserved', false, 'reason', 'budget');
    end if;
  end if;

  insert into public.elo_tts_budget_requests(user_id, request_key, usage, document_id, estimate_usd, status)
  values (p_user_id, p_request_key, p_usage, v_document, p_estimate_usd, 'reserved')
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return jsonb_build_object('reserved', false, 'reason', 'duplicate');
  end if;

  update public.elo_tts_budget_buckets
  set reserved_usd = reserved_usd + p_estimate_usd, updated_at = now()
  where user_id = p_user_id and month_start = v_month and document_id = '';
  if p_usage = 'audiobook' then
    update public.elo_tts_budget_buckets
    set reserved_usd = reserved_usd + p_estimate_usd, updated_at = now()
    where user_id = p_user_id and month_start = v_month and document_id = v_document;
  end if;
  return jsonb_build_object('reserved', true, 'estimate_usd', p_estimate_usd, 'estimate_only', true);
end;
$$;

create function public.elo_tts_settle(
  p_user_id uuid,
  p_request_key text,
  p_outcome text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.elo_tts_budget_requests%rowtype;
  v_month date;
begin
  if p_user_id is null or p_request_key is null or p_request_key !~ '^[a-f0-9]{64}$'
     or p_outcome is null or p_outcome not in ('completed', 'failed') then
    raise exception 'tts_budget_settlement_invalid' using errcode = '22023';
  end if;
  -- Read immutable request month, then lock user/month BEFORE request.
  select * into v_request from public.elo_tts_budget_requests
  where user_id = p_user_id and request_key = p_request_key;
  if not found then return jsonb_build_object('settled', false, 'reason', 'missing'); end if;
  v_month := date_trunc('month', v_request.created_at at time zone 'utc')::date;
  perform 1 from public.elo_tts_budget_buckets
  where user_id = p_user_id and month_start = v_month and document_id = '' for update;
  if not found then raise exception 'tts_budget_bucket_missing'; end if;
  select * into strict v_request from public.elo_tts_budget_requests
  where user_id = p_user_id and request_key = p_request_key for update;
  if v_request.status <> 'reserved' then
    return jsonb_build_object('settled', true, 'duplicate', true, 'status', v_request.status);
  end if;

  -- Never conceal accounting corruption by clamping negative reservations.
  update public.elo_tts_budget_buckets
  set reserved_usd = reserved_usd - v_request.estimate_usd,
      spent_usd = spent_usd + case when p_outcome = 'completed' then v_request.estimate_usd else 0 end,
      updated_at = now()
  where user_id = p_user_id and month_start = v_month and document_id = '';
  if v_request.usage = 'audiobook' then
    update public.elo_tts_budget_buckets
    set reserved_usd = reserved_usd - v_request.estimate_usd,
        spent_usd = spent_usd + case when p_outcome = 'completed' then v_request.estimate_usd else 0 end,
        updated_at = now()
    where user_id = p_user_id and month_start = v_month and document_id = v_request.document_id;
    if not found then raise exception 'tts_budget_document_bucket_missing'; end if;
  end if;
  update public.elo_tts_budget_requests
  set status = p_outcome, settled_at = now()
  where user_id = p_user_id and request_key = p_request_key;
  return jsonb_build_object('settled', true, 'status', p_outcome, 'estimate_only', true);
end;
$$;

revoke all on function public.elo_tts_reserve(uuid, text, text, text, numeric, numeric, numeric) from public, anon, authenticated;
revoke all on function public.elo_tts_settle(uuid, text, text) from public, anon, authenticated;
grant execute on function public.elo_tts_reserve(uuid, text, text, text, numeric, numeric, numeric) to service_role;
grant execute on function public.elo_tts_settle(uuid, text, text) to service_role;