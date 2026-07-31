-- Municipal E2E verification SQL.
-- Read-only checks only. Run manually after homologation in project mplpzyalcxhhinuvjthx.

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('municipal_assets', 'municipal_asset_history', 'municipal_notifications')
order by table_name;

select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('municipal_assets', 'municipal_asset_history', 'municipal_notifications')
  and column_name in ('institution_id', 'unit_id')
order by table_name, column_name;

select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('municipal_assets', 'municipal_asset_history', 'municipal_notifications')
order by c.relname;

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('municipal_assets', 'municipal_asset_history', 'municipal_notifications')
order by tablename, policyname;

select tablename, indexname
from pg_indexes
where schemaname = 'public'
  and tablename in ('municipal_assets', 'municipal_asset_history', 'municipal_notifications')
order by tablename, indexname;

select tc.table_name, tc.constraint_name, tc.constraint_type
from information_schema.table_constraints tc
where tc.table_schema = 'public'
  and tc.table_name = 'municipal_assets'
  and tc.constraint_name = 'municipal_assets_tag_per_institution_unique';

select tc.table_name, tc.constraint_name, cc.check_clause
from information_schema.table_constraints tc
join information_schema.check_constraints cc
  on cc.constraint_schema = tc.constraint_schema
 and cc.constraint_name = tc.constraint_name
where tc.table_schema = 'public'
  and tc.table_name = 'municipal_notifications'
  and tc.constraint_name in (
    'municipal_notifications_channel_check',
    'municipal_notifications_status_check'
  )
order by tc.constraint_name;

select 'municipal_assets' as table_name, count(*) as total_records from public.municipal_assets
union all
select 'municipal_asset_history' as table_name, count(*) as total_records from public.municipal_asset_history
union all
select 'municipal_notifications' as table_name, count(*) as total_records from public.municipal_notifications;

select 'municipal_assets' as table_name, count(*) as records_without_institution_id from public.municipal_assets where institution_id is null
union all
select 'municipal_asset_history' as table_name, count(*) as records_without_institution_id from public.municipal_asset_history where institution_id is null
union all
select 'municipal_notifications' as table_name, count(*) as records_without_institution_id from public.municipal_notifications where institution_id is null;

select 'municipal_assets' as table_name, count(*) as records_with_invalid_unit_id
from public.municipal_assets a
left join public.units u on u.id = a.unit_id and u.institution_id = a.institution_id
where a.unit_id is not null and u.id is null
union all
select 'municipal_asset_history' as table_name, count(*) as records_with_invalid_unit_id
from public.municipal_asset_history h
left join public.units u on u.id = h.unit_id and u.institution_id = h.institution_id
where h.unit_id is not null and u.id is null
union all
select 'municipal_notifications' as table_name, count(*) as records_with_invalid_unit_id
from public.municipal_notifications n
left join public.units u on u.id = n.unit_id and u.institution_id = n.institution_id
where n.unit_id is not null and u.id is null;

select institution_id, asset_tag, count(*) as duplicate_count
from public.municipal_assets
group by institution_id, asset_tag
having count(*) > 1
order by duplicate_count desc, institution_id, asset_tag;
