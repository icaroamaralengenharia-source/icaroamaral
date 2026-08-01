-- Municipal demo seed.
-- Manual execution only after replacing all DEMO_*_USER_ID placeholders with real demo Auth UUIDs.
-- All fictional operational data uses the DEMO_MUNICIPAL_ prefix.

do $$
begin
  if 'DEMO_PLATFORM_ADMIN_USER_ID' = 'DEMO_PLATFORM_ADMIN_USER_ID'
    or 'DEMO_MUNICIPAL_ADMIN_USER_ID' = 'DEMO_MUNICIPAL_ADMIN_USER_ID'
    or 'DEMO_GESTOR_USER_ID' = 'DEMO_GESTOR_USER_ID'
    or 'DEMO_LEITURA_USER_ID' = 'DEMO_LEITURA_USER_ID' then
    raise exception 'Replace all DEMO_*_USER_ID placeholders with real demo Auth UUIDs before running municipal-demo-seed.sql';
  end if;
end $$;

with demo_institution as (
  insert into public.institutions (name, document, city, state, status, created_by)
  select 'DEMO_MUNICIPAL_Prefeitura Municipal Demonstrativa', null, 'DEMO_MUNICIPAL_Cidade Demonstrativa', 'DM', 'active', 'DEMO_PLATFORM_ADMIN_USER_ID'::uuid
  where not exists (
    select 1 from public.institutions where name = 'DEMO_MUNICIPAL_Prefeitura Municipal Demonstrativa'
  )
  returning id
)
select id from demo_institution;

insert into public.units (institution_id, name, code, address, status)
select i.id, unit_data.name, unit_data.code, unit_data.address, 'active'
from public.institutions i
cross join (values
  ('DEMO_MUNICIPAL_Almoxarifado Central Demonstrativo', 'DEMO_MUNICIPAL_CENTRAL', 'DEMO_MUNICIPAL_Endereco Central'),
  ('DEMO_MUNICIPAL_Secretaria de Saude Demonstrativa', 'DEMO_MUNICIPAL_SAUDE', 'DEMO_MUNICIPAL_Endereco Saude'),
  ('DEMO_MUNICIPAL_Secretaria de Educacao Demonstrativa', 'DEMO_MUNICIPAL_EDUCACAO', 'DEMO_MUNICIPAL_Endereco Educacao')
) as unit_data(name, code, address)
where i.name = 'DEMO_MUNICIPAL_Prefeitura Municipal Demonstrativa'
  and not exists (
    select 1 from public.units u where u.institution_id = i.id and u.code = unit_data.code
  );

insert into public.profiles (auth_user_id, institution_id, unit_id, name, email, role, status)
select user_data.auth_user_id::uuid, i.id, u.id, user_data.name, user_data.email, user_data.role, 'active'
from public.institutions i
cross join (values
  ('DEMO_PLATFORM_ADMIN_USER_ID', null, 'DEMO_MUNICIPAL_Platform Admin', 'DEMO_MUNICIPAL_LOGIN_PLATFORM_ADMIN', 'platform_admin'),
  ('DEMO_MUNICIPAL_ADMIN_USER_ID', null, 'DEMO_MUNICIPAL_Admin Municipal', 'DEMO_MUNICIPAL_LOGIN_ADMIN', 'municipal_admin'),
  ('DEMO_GESTOR_USER_ID', 'DEMO_MUNICIPAL_CENTRAL', 'DEMO_MUNICIPAL_Gestor', 'DEMO_MUNICIPAL_LOGIN_GESTOR', 'gestor'),
  ('DEMO_LEITURA_USER_ID', 'DEMO_MUNICIPAL_CENTRAL', 'DEMO_MUNICIPAL_Leitura', 'DEMO_MUNICIPAL_LOGIN_LEITURA', 'leitura')
) as user_data(auth_user_id, unit_code, name, email, role)
left join public.units u on u.institution_id = i.id and u.code = user_data.unit_code
where i.name = 'DEMO_MUNICIPAL_Prefeitura Municipal Demonstrativa'
  and not exists (
    select 1 from public.profiles p where p.auth_user_id = user_data.auth_user_id::uuid
  );

insert into public.stock_items (institution_id, unit_id, name, category, unit, minimum_quantity, location, batch)
select i.id, u.id, item_data.name, item_data.category, item_data.unit, item_data.minimum_quantity, item_data.location, item_data.batch
from public.institutions i
cross join (values
  ('DEMO_MUNICIPAL_CENTRAL', 'DEMO_MUNICIPAL_Luvas', 'DEMO_MUNICIPAL_Material de Saude', 'cx', 10, 'DEMO_MUNICIPAL_Prateleira A', 'DEMO_MUNICIPAL_LOTE_LUVAS'),
  ('DEMO_MUNICIPAL_CENTRAL', 'DEMO_MUNICIPAL_Papel A4', 'DEMO_MUNICIPAL_Expediente', 'pct', 20, 'DEMO_MUNICIPAL_Prateleira B', 'DEMO_MUNICIPAL_LOTE_A4'),
  ('DEMO_MUNICIPAL_CENTRAL', 'DEMO_MUNICIPAL_Lampadas', 'DEMO_MUNICIPAL_Manutencao', 'un', 5, 'DEMO_MUNICIPAL_Prateleira C', 'DEMO_MUNICIPAL_LOTE_LAMP'),
  ('DEMO_MUNICIPAL_SAUDE', 'DEMO_MUNICIPAL_Material de Limpeza', 'DEMO_MUNICIPAL_Limpeza', 'un', 15, 'DEMO_MUNICIPAL_Deposito Saude', 'DEMO_MUNICIPAL_LOTE_LIMP'),
  ('DEMO_MUNICIPAL_EDUCACAO', 'DEMO_MUNICIPAL_Tubos', 'DEMO_MUNICIPAL_Manutencao', 'un', 8, 'DEMO_MUNICIPAL_Deposito Educacao', 'DEMO_MUNICIPAL_LOTE_TUBOS'),
  ('DEMO_MUNICIPAL_EDUCACAO', 'DEMO_MUNICIPAL_Conexoes', 'DEMO_MUNICIPAL_Manutencao', 'un', 8, 'DEMO_MUNICIPAL_Deposito Educacao', 'DEMO_MUNICIPAL_LOTE_CONEXOES'),
  ('DEMO_MUNICIPAL_CENTRAL', 'DEMO_MUNICIPAL_Ferramentas', 'DEMO_MUNICIPAL_Operacional', 'kit', 1, 'DEMO_MUNICIPAL_Armario Ferramentas', 'DEMO_MUNICIPAL_LOTE_FERR')
) as item_data(unit_code, name, category, unit, minimum_quantity, location, batch)
join public.units u on u.institution_id = i.id and u.code = item_data.unit_code
where i.name = 'DEMO_MUNICIPAL_Prefeitura Municipal Demonstrativa'
  and not exists (
    select 1 from public.stock_items si where si.institution_id = i.id and si.name = item_data.name
  );

insert into public.stock_entries (institution_id, unit_id, item_id, quantity, status, source, requested_by, approved_by, approved_at)
select si.institution_id, si.unit_id, si.id, movement.quantity, 'aprovada', movement.source, 'DEMO_GESTOR_USER_ID'::uuid, 'DEMO_MUNICIPAL_ADMIN_USER_ID'::uuid, now()
from public.stock_items si
join (values
  ('DEMO_MUNICIPAL_Luvas', 100, 'DEMO_MUNICIPAL_Entrada inicial'),
  ('DEMO_MUNICIPAL_Papel A4', 30, 'DEMO_MUNICIPAL_Entrada inicial'),
  ('DEMO_MUNICIPAL_Lampadas', 2, 'DEMO_MUNICIPAL_Entrada baixa'),
  ('DEMO_MUNICIPAL_Tubos', 20, 'DEMO_MUNICIPAL_Entrada inicial'),
  ('DEMO_MUNICIPAL_Conexoes', 20, 'DEMO_MUNICIPAL_Entrada inicial'),
  ('DEMO_MUNICIPAL_Ferramentas', 3, 'DEMO_MUNICIPAL_Entrada inicial')
) as movement(item_name, quantity, source) on movement.item_name = si.name
where not exists (
  select 1 from public.stock_entries se where se.item_id = si.id and se.source = movement.source
);

insert into public.stock_exits (institution_id, unit_id, item_id, quantity, destination_sector, purpose, responsible_name, created_by)
select si.institution_id, si.unit_id, si.id, movement.quantity, movement.destination, movement.purpose, 'DEMO_MUNICIPAL_Responsavel Ficticio', 'DEMO_GESTOR_USER_ID'::uuid
from public.stock_items si
join (values
  ('DEMO_MUNICIPAL_Luvas', 70, 'DEMO_MUNICIPAL_Unidade de Atendimento', 'DEMO_MUNICIPAL_Saida operacional'),
  ('DEMO_MUNICIPAL_Papel A4', 5, 'DEMO_MUNICIPAL_Administracao', 'DEMO_MUNICIPAL_Saida expediente'),
  ('DEMO_MUNICIPAL_Tubos', 3, 'DEMO_MUNICIPAL_Manutencao', 'DEMO_MUNICIPAL_Saida manutencao')
) as movement(item_name, quantity, destination, purpose) on movement.item_name = si.name
where not exists (
  select 1 from public.stock_exits sx where sx.item_id = si.id and sx.purpose = movement.purpose
);

insert into public.municipal_assets (institution_id, unit_id, asset_tag, name, description, category, brand, model, serial_number, acquisition_date, acquisition_value, condition, status, location, responsible_user_id, created_by)
select i.id, u.id, asset_data.asset_tag, asset_data.name, asset_data.description, asset_data.category, asset_data.brand, asset_data.model, null, current_date - interval '90 days', asset_data.value, asset_data.condition, asset_data.status, asset_data.location, 'DEMO_GESTOR_USER_ID'::uuid, 'DEMO_MUNICIPAL_ADMIN_USER_ID'::uuid
from public.institutions i
cross join (values
  ('DEMO_MUNICIPAL_CENTRAL', 'DEMO_MUNICIPAL_PAT_001', 'DEMO_MUNICIPAL_Computador', 'DEMO_MUNICIPAL_Equipamento de informatica', 'Informatica', 'DEMO_MUNICIPAL_Marca', 'DEMO_MUNICIPAL_Modelo', 3500.00, 'bom', 'ativo', 'DEMO_MUNICIPAL_Sala Administrativa'),
  ('DEMO_MUNICIPAL_CENTRAL', 'DEMO_MUNICIPAL_PAT_002', 'DEMO_MUNICIPAL_Impressora', 'DEMO_MUNICIPAL_Impressora demonstrativa', 'Informatica', 'DEMO_MUNICIPAL_Marca', 'DEMO_MUNICIPAL_Modelo', 1400.00, 'regular', 'ativo', 'DEMO_MUNICIPAL_Recepcao'),
  ('DEMO_MUNICIPAL_SAUDE', 'DEMO_MUNICIPAL_PAT_003', 'DEMO_MUNICIPAL_Cadeira', 'DEMO_MUNICIPAL_Cadeira demonstrativa', 'Mobiliario', 'DEMO_MUNICIPAL_Marca', 'DEMO_MUNICIPAL_Modelo', 300.00, 'ruim', 'ativo', 'DEMO_MUNICIPAL_Sala Saude'),
  ('DEMO_MUNICIPAL_EDUCACAO', 'DEMO_MUNICIPAL_PAT_004', 'DEMO_MUNICIPAL_Mesa', 'DEMO_MUNICIPAL_Mesa demonstrativa', 'Mobiliario', 'DEMO_MUNICIPAL_Marca', 'DEMO_MUNICIPAL_Modelo', 500.00, 'bom', 'transferido', 'DEMO_MUNICIPAL_Sala Educacao'),
  ('DEMO_MUNICIPAL_CENTRAL', 'DEMO_MUNICIPAL_PAT_005', 'DEMO_MUNICIPAL_Ar Condicionado', 'DEMO_MUNICIPAL_Climatizacao demonstrativa', 'Equipamento', 'DEMO_MUNICIPAL_Marca', 'DEMO_MUNICIPAL_Modelo', 2500.00, 'regular', 'em_manutencao', 'DEMO_MUNICIPAL_Manutencao'),
  ('DEMO_MUNICIPAL_CENTRAL', 'DEMO_MUNICIPAL_PAT_006', 'DEMO_MUNICIPAL_Veiculo Administrativo Ficticio', 'DEMO_MUNICIPAL_Veiculo sem placa real', 'Veiculo', 'DEMO_MUNICIPAL_Marca', 'DEMO_MUNICIPAL_Modelo', 70000.00, 'inservivel', 'baixado', 'DEMO_MUNICIPAL_Garagem')
) as asset_data(unit_code, asset_tag, name, description, category, brand, model, value, condition, status, location)
join public.units u on u.institution_id = i.id and u.code = asset_data.unit_code
where i.name = 'DEMO_MUNICIPAL_Prefeitura Municipal Demonstrativa'
  and not exists (
    select 1 from public.municipal_assets a where a.institution_id = i.id and a.asset_tag = asset_data.asset_tag
  );

insert into public.municipal_asset_history (asset_id, institution_id, unit_id, action, actor_user_id, metadata)
select a.id, a.institution_id, a.unit_id, history.action, 'DEMO_MUNICIPAL_ADMIN_USER_ID'::uuid, jsonb_build_object('label', history.label)
from public.municipal_assets a
join (values
  ('DEMO_MUNICIPAL_PAT_004', 'asset_transferred', 'DEMO_MUNICIPAL_transferencia'),
  ('DEMO_MUNICIPAL_PAT_005', 'asset_maintenance_started', 'DEMO_MUNICIPAL_manutencao'),
  ('DEMO_MUNICIPAL_PAT_006', 'asset_deactivated', 'DEMO_MUNICIPAL_baixa')
) as history(asset_tag, action, label) on history.asset_tag = a.asset_tag
where not exists (
  select 1 from public.municipal_asset_history h where h.asset_id = a.id and h.action = history.action
);

insert into public.municipal_documents (institution_id, unit_id, title, description, document_type, status, current_version, created_by)
select i.id, u.id, doc_data.title, doc_data.description, doc_data.document_type, 'active', 1, 'DEMO_GESTOR_USER_ID'::uuid
from public.institutions i
cross join (values
  ('DEMO_MUNICIPAL_CENTRAL', 'DEMO_MUNICIPAL_Relatorio de Estoque', 'DEMO_MUNICIPAL_Relatorio demonstrativo de estoque', 'relatorio'),
  ('DEMO_MUNICIPAL_CENTRAL', 'DEMO_MUNICIPAL_Termo de Recebimento', 'DEMO_MUNICIPAL_Termo demonstrativo', 'termo'),
  ('DEMO_MUNICIPAL_CENTRAL', 'DEMO_MUNICIPAL_Relatorio Patrimonial', 'DEMO_MUNICIPAL_Relatorio de bens demonstrativos', 'relatorio'),
  ('DEMO_MUNICIPAL_CENTRAL', 'DEMO_MUNICIPAL_Relatorio Administrativo', 'DEMO_MUNICIPAL_Relatorio administrativo demonstrativo', 'prestacao_contas')
) as doc_data(unit_code, title, description, document_type)
join public.units u on u.institution_id = i.id and u.code = doc_data.unit_code
where i.name = 'DEMO_MUNICIPAL_Prefeitura Municipal Demonstrativa'
  and not exists (
    select 1 from public.municipal_documents d where d.institution_id = i.id and d.title = doc_data.title
  );

insert into public.municipal_document_versions (document_id, institution_id, unit_id, version_number, original_filename, mime_type, size_bytes, file_reference, file_hash, uploaded_by)
select d.id, d.institution_id, d.unit_id, 1, lower(replace(d.title, 'DEMO_MUNICIPAL_', 'demo-municipal-')) || '.pdf', 'application/pdf', 1024, '/api/municipal-admin/document-files/demo-municipal.pdf', 'DEMO_MUNICIPAL_HASH_' || substr(md5(d.title), 1, 16), 'DEMO_GESTOR_USER_ID'::uuid
from public.municipal_documents d
where d.title like 'DEMO_MUNICIPAL_%'
  and not exists (
    select 1 from public.municipal_document_versions v where v.document_id = d.id and v.version_number = 1
  );

insert into public.municipal_admin_audit_log (actor_user_id, institution_id, target_type, target_id, action, metadata)
select 'DEMO_GESTOR_USER_ID'::uuid, i.id, 'municipal_demo', null, audit_data.action, jsonb_build_object('demo', true, 'label', audit_data.label)
from public.institutions i
cross join (values
  ('sentinel_scan_executed', 'DEMO_MUNICIPAL_estoque baixo'),
  ('sentinel_alert_acknowledged', 'DEMO_MUNICIPAL_alerta reconhecido'),
  ('sentinel_alert_resolved', 'DEMO_MUNICIPAL_alerta resolvido'),
  ('document_created', 'DEMO_MUNICIPAL_documento pendente'),
  ('notification_created', 'DEMO_MUNICIPAL_notificacao')
) as audit_data(action, label)
where i.name = 'DEMO_MUNICIPAL_Prefeitura Municipal Demonstrativa'
  and not exists (
    select 1 from public.municipal_admin_audit_log l where l.institution_id = i.id and l.action = audit_data.action and l.metadata ->> 'label' = audit_data.label
  );

insert into public.municipal_notifications (institution_id, unit_id, recipient_user_id, source_type, source_id, channel, title, message, severity, status, deduplication_key, read_at, metadata)
select i.id, u.id, notice.recipient::uuid, notice.source_type, notice.source_id, 'in_app', notice.title, notice.message, notice.severity, notice.status, notice.deduplication_key, notice.read_at, jsonb_build_object('demo', true)
from public.institutions i
join public.units u on u.institution_id = i.id and u.code = 'DEMO_MUNICIPAL_CENTRAL'
cross join (values
  ('DEMO_GESTOR_USER_ID', 'sentinel_alert', 'DEMO_MUNICIPAL_alerta_estoque_baixo', 'DEMO_MUNICIPAL_Estoque baixo', 'DEMO_MUNICIPAL_Item abaixo do minimo', 'high', 'sent', 'DEMO_MUNICIPAL_notification_low_stock', null::timestamptz),
  ('DEMO_GESTOR_USER_ID', 'sentinel_alert', 'DEMO_MUNICIPAL_alerta_item_zerado', 'DEMO_MUNICIPAL_Item zerado', 'DEMO_MUNICIPAL_Item sem saldo', 'critical', 'read', 'DEMO_MUNICIPAL_notification_zero_stock', now()),
  ('DEMO_MUNICIPAL_ADMIN_USER_ID', 'asset', 'DEMO_MUNICIPAL_PAT_003', 'DEMO_MUNICIPAL_Patrimonio ruim', 'DEMO_MUNICIPAL_Bem em estado ruim', 'medium', 'sent', 'DEMO_MUNICIPAL_notification_asset_bad', null::timestamptz),
  ('DEMO_MUNICIPAL_ADMIN_USER_ID', 'document', 'DEMO_MUNICIPAL_documento_pendente', 'DEMO_MUNICIPAL_Documento pendente', 'DEMO_MUNICIPAL_Relatorio pendente de revisao', 'low', 'read', 'DEMO_MUNICIPAL_notification_document_pending', now())
) as notice(recipient, source_type, source_id, title, message, severity, status, deduplication_key, read_at)
where i.name = 'DEMO_MUNICIPAL_Prefeitura Municipal Demonstrativa'
  and not exists (
    select 1 from public.municipal_notifications n where n.deduplication_key = notice.deduplication_key
  );