-- Municipal demo live verification for ETAPA 52.
-- Strictly read-only: SELECT, WITH and comments only.
-- Run manually only after explicit authorization in the isolated demo project.

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

select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
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
order by c.relname;

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
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
order by tablename, policyname;

select tablename, indexname
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'stock_items',
    'stock_entries',
    'stock_exits',
    'municipal_documents',
    'municipal_document_versions',
    'municipal_assets',
    'municipal_asset_history',
    'municipal_notifications'
  )
order by tablename, indexname;

select tc.table_name, tc.constraint_name, tc.constraint_type
from information_schema.table_constraints tc
where tc.table_schema = 'public'
  and tc.table_name in (
    'municipal_assets',
    'municipal_notifications',
    'stock_entries',
    'stock_exits',
    'municipal_document_versions'
  )
  and tc.constraint_type in ('PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY', 'CHECK')
order by tc.table_name, tc.constraint_name;

with live_institutions as (
  select id
  from public.institutions
  where name like 'DEMO_MUNICIPAL_LIVE_52_%'
)
select 'dados_live_52' as check_name, table_name, total
from (
  select 'institutions' as table_name, count(*) as total from live_institutions
  union all select 'units', count(*) from public.units u join live_institutions i on i.id = u.institution_id where u.name like 'DEMO_MUNICIPAL_LIVE_52_%'
  union all select 'profiles', count(*) from public.profiles p join live_institutions i on i.id = p.institution_id where p.name like 'DEMO_MUNICIPAL_LIVE_52_%'
  union all select 'stock_items', count(*) from public.stock_items s join live_institutions i on i.id = s.institution_id where s.name like 'DEMO_MUNICIPAL_LIVE_52_%'
  union all select 'stock_entries', count(*) from public.stock_entries e join live_institutions i on i.id = e.institution_id
  union all select 'stock_exits', count(*) from public.stock_exits x join live_institutions i on i.id = x.institution_id
  union all select 'municipal_assets', count(*) from public.municipal_assets a join live_institutions i on i.id = a.institution_id where a.asset_tag like 'DEMO_MUNICIPAL_LIVE_52_%'
  union all select 'municipal_asset_history', count(*) from public.municipal_asset_history h join live_institutions i on i.id = h.institution_id
  union all select 'municipal_documents', count(*) from public.municipal_documents d join live_institutions i on i.id = d.institution_id where d.title like 'DEMO_MUNICIPAL_LIVE_52_%'
  union all select 'municipal_document_versions', count(*) from public.municipal_document_versions v join live_institutions i on i.id = v.institution_id
  union all select 'municipal_notifications', count(*) from public.municipal_notifications n join live_institutions i on i.id = n.institution_id where n.deduplication_key like 'DEMO_MUNICIPAL_LIVE_52_%'
) checks
order by table_name;

with live_institutions as (
  select id
  from public.institutions
  where name like 'DEMO_MUNICIPAL_LIVE_52_%'
)
select 'registros_fora_do_escopo' as check_name, table_name, total
from (
  select 'units' as table_name, count(*) as total from public.units where name like 'DEMO_MUNICIPAL_LIVE_52_%' and institution_id not in (select id from live_institutions)
  union all select 'stock_items', count(*) from public.stock_items where name like 'DEMO_MUNICIPAL_LIVE_52_%' and institution_id not in (select id from live_institutions)
  union all select 'municipal_assets', count(*) from public.municipal_assets where asset_tag like 'DEMO_MUNICIPAL_LIVE_52_%' and institution_id not in (select id from live_institutions)
  union all select 'municipal_documents', count(*) from public.municipal_documents where title like 'DEMO_MUNICIPAL_LIVE_52_%' and institution_id not in (select id from live_institutions)
  union all select 'municipal_notifications', count(*) from public.municipal_notifications where deduplication_key like 'DEMO_MUNICIPAL_LIVE_52_%' and institution_id not in (select id from live_institutions)
) checks
order by table_name;

with scoped_units as (
  select u.id, u.institution_id
  from public.units u
  join public.institutions i on i.id = u.institution_id
  where i.name like 'DEMO_MUNICIPAL_LIVE_52_%'
)
select 'unit_id_invalido' as check_name, table_name, total
from (
  select 'stock_items' as table_name, count(*) as total from public.stock_items s left join scoped_units u on u.id = s.unit_id and u.institution_id = s.institution_id where s.name like 'DEMO_MUNICIPAL_LIVE_52_%' and u.id is null
  union all select 'municipal_assets', count(*) from public.municipal_assets a left join scoped_units u on u.id = a.unit_id and u.institution_id = a.institution_id where a.asset_tag like 'DEMO_MUNICIPAL_LIVE_52_%' and u.id is null
  union all select 'municipal_notifications', count(*) from public.municipal_notifications n left join scoped_units u on u.id = n.unit_id and u.institution_id = n.institution_id where n.deduplication_key like 'DEMO_MUNICIPAL_LIVE_52_%' and n.unit_id is not null and u.id is null
  union all select 'municipal_documents', count(*) from public.municipal_documents d left join scoped_units u on u.id = d.unit_id and u.institution_id = d.institution_id where d.title like 'DEMO_MUNICIPAL_LIVE_52_%' and d.unit_id is not null and u.id is null
) checks
order by table_name;

with live_items as (
  select s.id, s.institution_id, s.unit_id, s.name, coalesce(sum(e.quantity) filter (where e.status in ('aprovada', 'approved')), 0) as entradas, coalesce(sum(x.quantity) filter (where x.status in ('aprovada', 'approved')), 0) as saidas
  from public.stock_items s
  left join public.stock_entries e on e.item_id = s.id
  left join public.stock_exits x on x.item_id = s.id
  where s.name like 'DEMO_MUNICIPAL_LIVE_52_%'
  group by s.id, s.institution_id, s.unit_id, s.name
)
select 'saldo_negativo' as check_name, id, institution_id, unit_id, name, entradas, saidas, entradas - saidas as saldo
from live_items
where entradas - saidas < 0
order by name;

select 'tombamento_duplicado' as check_name, institution_id, asset_tag, count(*) as total
from public.municipal_assets
where asset_tag like 'DEMO_MUNICIPAL_LIVE_52_%'
group by institution_id, asset_tag
having count(*) > 1
order by asset_tag;

select 'operation_id_duplicado' as check_name, metadata ->> 'operation_id' as operation_id, count(*) as total
from public.municipal_admin_audit_log
where metadata ->> 'operation_id' like 'DEMO_MUNICIPAL_LIVE_52_%'
group by metadata ->> 'operation_id'
having count(*) > 1
order by operation_id;

select 'deduplication_key_duplicada' as check_name, deduplication_key, count(*) as total
from public.municipal_notifications
where deduplication_key like 'DEMO_MUNICIPAL_LIVE_52_%'
group by deduplication_key
having count(*) > 1
order by deduplication_key;

select 'historico_ausente' as check_name, a.id, a.asset_tag
from public.municipal_assets a
left join public.municipal_asset_history h on h.asset_id = a.id
where a.asset_tag like 'DEMO_MUNICIPAL_LIVE_52_%'
  and a.status in ('transferido', 'em_manutencao', 'baixado')
  and h.id is null
order by a.asset_tag;

select 'auditoria_ausente' as check_name, entity_type, entity_id
from (
  select 'municipal_assets' as entity_type, a.id as entity_id, a.institution_id from public.municipal_assets a where a.asset_tag like 'DEMO_MUNICIPAL_LIVE_52_%'
  union all select 'municipal_documents', d.id, d.institution_id from public.municipal_documents d where d.title like 'DEMO_MUNICIPAL_LIVE_52_%'
  union all select 'municipal_notifications', n.id, n.institution_id from public.municipal_notifications n where n.deduplication_key like 'DEMO_MUNICIPAL_LIVE_52_%'
) entities
where not exists (
  select 1
  from public.municipal_admin_audit_log l
  where l.institution_id = entities.institution_id
    and l.entity_type = entities.entity_type
    and l.entity_id = entities.entity_id
)
order by entity_type;

select 'notificacoes_externas' as check_name, id, channel, status
from public.municipal_notifications
where deduplication_key like 'DEMO_MUNICIPAL_LIVE_52_%'
  and channel <> 'in_app'
order by created_at;

select 'inconsistencia_instituicao_unidade' as check_name, table_name, entity_id
from (
  select 'stock_items' as table_name, s.id as entity_id, s.institution_id, s.unit_id from public.stock_items s where s.name like 'DEMO_MUNICIPAL_LIVE_52_%'
  union all select 'municipal_assets', a.id, a.institution_id, a.unit_id from public.municipal_assets a where a.asset_tag like 'DEMO_MUNICIPAL_LIVE_52_%'
  union all select 'municipal_documents', d.id, d.institution_id, d.unit_id from public.municipal_documents d where d.title like 'DEMO_MUNICIPAL_LIVE_52_%' and d.unit_id is not null
  union all select 'municipal_notifications', n.id, n.institution_id, n.unit_id from public.municipal_notifications n where n.deduplication_key like 'DEMO_MUNICIPAL_LIVE_52_%' and n.unit_id is not null
) scoped
left join public.units u on u.id = scoped.unit_id and u.institution_id = scoped.institution_id
where scoped.unit_id is not null
  and u.id is null
order by table_name;
