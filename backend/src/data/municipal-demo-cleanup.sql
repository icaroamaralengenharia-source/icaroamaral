-- Municipal demo cleanup.
-- Manual only. Never run automatically.
-- Removes only records carrying the DEMO_MUNICIPAL_ prefix and never deletes Auth users or schemas.

delete from public.municipal_notifications
where deduplication_key like 'DEMO_MUNICIPAL_%'
  or title like 'DEMO_MUNICIPAL_%'
  or source_id like 'DEMO_MUNICIPAL_%';

delete from public.municipal_document_versions
where document_id in (
  select id from public.municipal_documents where title like 'DEMO_MUNICIPAL_%'
)
  or file_hash like 'DEMO_MUNICIPAL_%';

delete from public.municipal_documents
where title like 'DEMO_MUNICIPAL_%';

delete from public.municipal_asset_history
where asset_id in (
  select id from public.municipal_assets where asset_tag like 'DEMO_MUNICIPAL_%'
)
  or metadata::text like '%DEMO_MUNICIPAL_%';

delete from public.municipal_assets
where asset_tag like 'DEMO_MUNICIPAL_%'
  or name like 'DEMO_MUNICIPAL_%';

delete from public.stock_audit_log
where metadata::text like '%DEMO_MUNICIPAL_%'
  or action like 'DEMO_MUNICIPAL_%';

delete from public.stock_exits
where item_id in (
  select id from public.stock_items where name like 'DEMO_MUNICIPAL_%'
)
  or purpose like 'DEMO_MUNICIPAL_%'
  or destination_sector like 'DEMO_MUNICIPAL_%';

delete from public.stock_entries
where item_id in (
  select id from public.stock_items where name like 'DEMO_MUNICIPAL_%'
)
  or source like 'DEMO_MUNICIPAL_%';

delete from public.stock_items
where name like 'DEMO_MUNICIPAL_%'
  or batch like 'DEMO_MUNICIPAL_%';

delete from public.municipal_admin_audit_log
where metadata::text like '%DEMO_MUNICIPAL_%'
  or metadata ->> 'demo' = 'true';

delete from public.profiles
where name like 'DEMO_MUNICIPAL_%';

delete from public.units
where name like 'DEMO_MUNICIPAL_%'
  or code like 'DEMO_MUNICIPAL_%';

delete from public.institutions
where name = 'DEMO_MUNICIPAL_Prefeitura Municipal Demonstrativa';
