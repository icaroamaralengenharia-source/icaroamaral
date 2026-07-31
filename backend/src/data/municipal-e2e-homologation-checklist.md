# Homologacao E2E dos Schemas Municipais

## Escopo autorizado

- Projeto Supabase autorizado: `mplpzyalcxhhinuvjthx`.
- Projeto proibido: `lidueokjpzxdybtongbk`.
- Nao abrir, consultar, colar SQL ou executar qualquer comando no projeto proibido.
- Esta homologacao e manual e controlada. Nenhum SQL deve ser executado automaticamente por scripts, CI ou CLI.

## Arquivos de schema

1. `backend/src/data/municipal-asset-schema.sql`
2. `backend/src/data/municipal-notification-schema.sql`

## Ordem manual de execucao

1. Confirmar visualmente no Supabase Dashboard que o project ref e `mplpzyalcxhhinuvjthx`.
2. Confirmar que o SQL Editor nao esta aberto em `lidueokjpzxdybtongbk`.
3. Executar primeiro `municipal-asset-schema.sql`.
4. Executar depois `municipal-notification-schema.sql`.
5. Nao executar outro arquivo SQL nesta homologacao.
6. Salvar evidencias antes e depois de cada execucao.

## Comandos SQL somente leitura de verificacao pos-SQL

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('municipal_assets', 'municipal_asset_history', 'municipal_notifications')
order by table_name;

select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('municipal_assets', 'municipal_asset_history', 'municipal_notifications')
order by table_name, ordinal_position;

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
```

## Tabelas esperadas

- `municipal_assets`
- `municipal_asset_history`
- `municipal_notifications`

## Politicas RLS esperadas

- RLS deve estar ativo nas tres tabelas.
- `municipal_notifications` deve criar policies idempotentes:
  - `municipal_notifications_select_scoped`
  - `municipal_notifications_service_all`
- `municipal_assets` deve criar policies idempotentes:
  - `municipal_assets_select_scoped`
  - `municipal_assets_write_admin_scoped`
- `municipal_asset_history` deve criar policies idempotentes:
  - `municipal_asset_history_select_scoped`
  - `municipal_asset_history_write_admin_scoped`
- As policies de patrimonio devem usar `institution_id` e `unit_id`, sem `project_id`, e bloquear escrita para perfil `leitura`.

## Indices esperados

- `municipal_assets_institution_unit_idx`
- `municipal_assets_status_idx`
- `municipal_assets_condition_idx`
- `municipal_assets_category_idx`
- `municipal_assets_responsible_idx`
- `municipal_assets_updated_idx`
- `municipal_asset_history_asset_idx`
- `municipal_asset_history_scope_idx`
- `municipal_notifications_institution_idx`
- `municipal_notifications_unit_idx`
- `municipal_notifications_recipient_idx`
- `municipal_notifications_source_idx`
- `municipal_notifications_status_idx`

## Testes de isolamento

- Gestor deve ver somente bens/notificacoes da unidade autorizada.
- Leitura deve consultar sem escrita.
- Tenant externo deve retornar 403 ou lista vazia segura.
- Troca manual de `institution_id` ou `unit_id` deve ser bloqueada pelo backend.
- Nenhum dado do projeto proibido pode aparecer nas evidencias.

## Plano de rollback aditivo/documentado

- Nao usar `DROP`, `TRUNCATE` ou `DELETE` como rollback padrao.
- Se houver falha antes de uso funcional, documentar tabelas/indices criados e pausar homologacao.
- Se houver necessidade de remocao, abrir etapa propria de rollback com aprovacao explicita, backup de metadados e avaliacao de dados pessoais.
- Preferir correcoes aditivas: novas policies, novos indices, novas constraints seguras ou ajustes de backend.

## Validacao de patrimonio

- Criar um bem de homologacao somente via API real, em etapa autorizada separada.
- Confirmar `institution_id`, `unit_id`, `asset_tag` unico por instituicao, status e conservacao.
- Confirmar historico em transferencia, manutencao e baixa.
- Confirmar que baixa nao exclui o registro.
- Confirmar cache offline somente leitura e separado por usuario, instituicao e unidade.
- Confirmar por SQL de metadados que as quatro policies RLS de patrimonio existem antes de aprovar escrita em homologacao.

## Validacao de notificacoes

- Criar notificacao `in_app` somente via API real, em etapa autorizada separada.
- Confirmar deduplicacao por `deduplication_key`.
- Confirmar unread-count, marcar como lida e cancelamento.
- Confirmar que email e WhatsApp permanecem desativados sem credenciais.
- Confirmar sanitizacao de mensagem e metadados sensiveis.

## Validacao do painel integrado

- Abrir painel municipal com usuario E2E autorizado.
- Validar navegacao: Visao Geral, Almoxarifados, Prateleira Operacional, Sentinela, Relatorios, Acervo, Patrimonio, Auditoria, Notificacoes e Assistente ELO.
- Confirmar contador do sino de notificacoes.
- Confirmar que o ELO abre com contexto municipal autorizado, sem expor IDs tecnicos.
- Confirmar responsividade em desktop, tablet e iPhone.

## Evidencias necessarias para aprovacao

- Screenshot do project ref `mplpzyalcxhhinuvjthx` antes da execucao manual.
- Resultado dos SQLs de verificacao somente leitura.
- Lista de tabelas, indices e RLS ativada.
- Evidencias dos testes de isolamento.
- Evidencias de patrimonio e notificacoes no painel.
- `git status --short` sem alteracoes nao planejadas antes de qualquer commit futuro.
