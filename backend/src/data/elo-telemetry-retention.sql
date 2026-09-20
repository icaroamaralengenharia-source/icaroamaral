-- ELO telemetry retention: remove only events older than 60 days.
-- The backend scheduler is the runtime fallback. This optional pg_cron block is
-- idempotent and activates only when pg_cron is available and installable.

create or replace function public.elo_telemetry_retention_cleanup()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  removed integer;
begin
  delete from public.elo_telemetry_events
  where occurred_at < now() - interval '60 days';
  get diagnostics removed = row_count;
  return removed;
end;
$function$;

revoke all on function public.elo_telemetry_retention_cleanup() from public, anon, authenticated;

do $block$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      execute 'create extension if not exists pg_cron';
    exception when others then
      null;
    end;
  end if;
end;
$block$;

do $block$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_namespace where nspname = 'cron') then
    if not exists (select 1 from cron.job where jobname = 'elo-telemetry-retention-60d') then
      execute $$select cron.schedule('elo-telemetry-retention-60d', '17 3 * * *', 'select public.elo_telemetry_retention_cleanup()')$$;
    end if;
  end if;
end;
$block$;
