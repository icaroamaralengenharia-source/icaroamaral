-- Municipal demo verification.
-- Strictly read-only: SELECT, WITH and comments only.

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'institutions',
    'units',
    'profiles',
    'municipal_admin_audit_log',
    'stock_items',
    'stock_entries',
    'stock_exits',
    'stock_audit_log',
    'municipal_documents',
    'municipal_document_versions',
    'municipal_assets',
    'municipal_asset_history',
    'municipal_notifications'
  )
order by table_name;

select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('institutions','units','profiles','stock_items','stock_entries','stock_exits','municipal_documents','municipal_document_versions','municipal_assets','municipal_asset_history','municipal_notifications','municipal_admin_audit_log')
  and column_name in ('institution_id','unit_id','auth_user_id','asset_tag','deduplication_key','source_id','operation_id')
order by table_name, ordinal_position;

select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('institutions','units','profiles','municipal_admin_audit_log','stock_items','stock_entries','stock_exits','stock_audit_log','municipal_documents','municipal_document_versions','municipal_assets','municipal_asset_history','municipal_notifications')
order by c.relname;

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('institutions','units','profiles','municipal_admin_audit_log','stock_items','stock_entries','stock_exits','stock_audit_log','municipal_documents','municipal_document_versions','municipal_assets','municipal_asset_history','municipal_notifications')
order by tablename, policyname;

select tablename, indexname
from pg_indexes
where schemaname = 'public'
  and tablename in ('institutions','units','profiles','municipal_admin_audit_log','stock_items','stock_entries','stock_exits','stock_audit_log','municipal_documents','municipal_document_versions','municipal_assets','municipal_asset_history','municipal_notifications')
order by tablename, indexname;

with demo_institution as (
  select id from public.institutions where name = 'DEMO_MUNICIPAL_Prefeitura Municipal Demonstrativa'
)
select 'demo_institution' as check_name, count(*) as total
from demo_institution
union all
select 'demo_units', count(*)
from public.units u join demo_institution i on i.id = u.institution_id
where u.name like 'DEMO_MUNICIPAL_%'
union all
select 'demo_profiles', count(*)
from public.profiles p join demo_institution i on i.id = p.institution_id
where p.name like 'DEMO_MUNICIPAL_%'
union all
select 'demo_stock_items', count(*)
from public.stock_items s join demo_institution i on i.id = s.institution_id
where s.name like 'DEMO_MUNICIPAL_%'
union all
select 'demo_stock_entries', count(*)
from public.stock_entries e join demo_institution i on i.id = e.institution_id
union all
select 'demo_stock_exits', count(*)
from public.stock_exits x join demo_institution i on i.id = x.institution_id
union all
select 'demo_assets', count(*)
from public.municipal_assets a join demo_institution i on i.id = a.institution_id
where a.asset_tag like 'DEMO_MUNICIPAL_%'
union all
select 'demo_asset_history', count(*)
from public.municipal_asset_history h join demo_institution i on i.id = h.institution_id
union all
select 'demo_documents', count(*)
from public.municipal_documents d join demo_institution i on i.id = d.institution_id
where d.title like 'DEMO_MUNICIPAL_%'
union all
select 'demo_notifications', count(*)
from public.municipal_notifications n join demo_institution i on i.id = n.institution_id
where n.deduplication_key like 'DEMO_MUNICIPAL_%'
union all
select 'demo_alert_audit', count(*)
from public.municipal_admin_audit_log l join demo_institution i on i.id = l.institution_id
where l.metadata ->> 'demo' = 'true';

with scoped as (
  select id from public.institutions where name = 'DEMO_MUNICIPAL_Prefeitura Municipal Demonstrativa'
)
select 'records_without_institution_id' as check_name, table_name, total
from (
  select 'units' as table_name, count(*) as total from public.units where name like 'DEMO_MUNICIPAL_%' and institution_id is null
  union all select 'profiles', count(*) from public.profiles where name like 'DEMO_MUNICIPAL_%' and institution_id is null
  union all select 'stock_items', count(*) from public.stock_items where name like 'DEMO_MUNICIPAL_%' and institution_id is null
  union all select 'municipal_assets', count(*) from public.municipal_assets where asset_tag like 'DEMO_MUNICIPAL_%' and institution_id is null
  union all select 'municipal_documents', count(*) from public.municipal_documents where title like 'DEMO_MUNICIPAL_%' and institution_id is null
  union all select 'municipal_notifications', count(*) from public.municipal_notifications where deduplication_key like 'DEMO_MUNICIPAL_%' and institution_id is null
) checks
union all
select 'invalid_unit_id', table_name, total
from (
  select 'stock_items' as table_name, count(*) as total from public.stock_items s join scoped i on i.id = s.institution_id left join public.units u on u.id = s.unit_id and u.institution_id = s.institution_id where s.name like 'DEMO_MUNICIPAL_%' and u.id is null
  union all select 'municipal_assets', count(*) from public.municipal_assets a join scoped i on i.id = a.institution_id left join public.units u on u.id = a.unit_id and u.institution_id = a.institution_id where a.asset_tag like 'DEMO_MUNICIPAL_%' and u.id is null
  union all select 'municipal_notifications', count(*) from public.municipal_notifications n join scoped i on i.id = n.institution_id left join public.units u on u.id = n.unit_id and u.institution_id = n.institution_id where n.deduplication_key like 'DEMO_MUNICIPAL_%' and n.unit_id is not null and u.id is null
) checks;

select institution_id, asset_tag, count(*) as duplicated
from public.municipal_assets
where asset_tag like 'DEMO_MUNICIPAL_%'
group by institution_id, asset_tag
having count(*) > 1;

select deduplication_key, count(*) as duplicated
from public.municipal_notifications
where deduplication_key like 'DEMO_MUNICIPAL_%'
group by deduplication_key
having count(*) > 1;

select action, metadata ->> 'operation_id' as operation_id, count(*) as duplicated
from public.municipal_admin_audit_log
where metadata ->> 'operation_id' like 'DEMO_MUNICIPAL_%'
group by action, metadata ->> 'operation_id'
having count(*) > 1;

select 'outside_demo_prefix' as check_name, table_name, total
from (
  select 'institutions' as table_name, count(*) as total from public.institutions where name = 'Prefeitura Municipal Demonstrativa'
  union all select 'units', count(*) from public.units where name in ('Almoxarifado Central Demonstrativo','Secretaria de Saude Demonstrativa','Secretaria de Educacao Demonstrativa')
  union all select 'assets', count(*) from public.municipal_assets where name in ('Computador','Impressora','Cadeira','Mesa')
) checks;
