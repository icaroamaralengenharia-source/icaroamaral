create table if not exists public.municipal_notifications (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  unit_id uuid references public.units(id),
  recipient_user_id uuid not null,
  source_type text not null,
  source_id text not null,
  channel text not null default 'in_app' check (channel in ('in_app', 'email', 'whatsapp')),
  title text not null,
  message text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'delivered', 'read', 'failed', 'cancelled')),
  deduplication_key text not null,
  scheduled_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint municipal_notifications_dedup_unique unique (deduplication_key)
);

create index if not exists municipal_notifications_institution_idx on public.municipal_notifications(institution_id, created_at desc);
create index if not exists municipal_notifications_unit_idx on public.municipal_notifications(institution_id, unit_id, created_at desc);
create index if not exists municipal_notifications_recipient_idx on public.municipal_notifications(recipient_user_id, status, created_at desc);
create index if not exists municipal_notifications_source_idx on public.municipal_notifications(source_type, source_id);
create index if not exists municipal_notifications_status_idx on public.municipal_notifications(status, scheduled_at);

alter table public.municipal_notifications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'municipal_notifications'
      and policyname = 'municipal_notifications_select_scoped'
  ) then
    create policy municipal_notifications_select_scoped
      on public.municipal_notifications for select
      using (institution_id::text = coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'institution_id', ''));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'municipal_notifications'
      and policyname = 'municipal_notifications_service_all'
  ) then
    create policy municipal_notifications_service_all
      on public.municipal_notifications for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;
