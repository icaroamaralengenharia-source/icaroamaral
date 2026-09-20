create extension if not exists pgcrypto;

create table if not exists public.elo_telemetry_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  occurred_at timestamptz not null default now(),
  session_hash text,
  anonymous_user_hash text,
  tenant_hash text,
  project_hash text,
  surface text not null,
  event_type text not null,
  route text,
  answer_mode text,
  proactivity_level text,
  self_check_level text,
  latency_ms integer,
  backend_latency_ms integer,
  model_latency_ms integer,
  status text,
  http_status integer,
  error_code text,
  fallback_used boolean,
  offline_used boolean,
  retry_count integer,
  attachment_type text,
  attachment_size_bucket text,
  response_size_bucket text,
  context_turn_count_bucket text,
  memory_used boolean,
  project_context_used boolean,
  risk_detected boolean,
  missing_essential_count integer,
  action_type text,
  model_class text,
  token_usage_bucket text,
  estimated_cost_bucket text,
  created_at timestamptz not null default now()
);

create index if not exists elo_telemetry_events_occurred_at_idx on public.elo_telemetry_events (occurred_at desc);
create index if not exists elo_telemetry_events_type_idx on public.elo_telemetry_events (event_type, occurred_at desc);
create index if not exists elo_telemetry_events_route_idx on public.elo_telemetry_events (route, occurred_at desc);
create index if not exists elo_telemetry_events_tenant_idx on public.elo_telemetry_events (tenant_hash, occurred_at desc);

alter table public.elo_telemetry_events enable row level security;

-- No anon/authenticated policy is intentional. The backend service role is the only writer/reader.
