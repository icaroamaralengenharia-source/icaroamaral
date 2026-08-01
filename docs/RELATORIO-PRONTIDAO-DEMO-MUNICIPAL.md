# Relatorio de Prontidao Demo Municipal

Data: 2026-08-01

Branch: main

HEAD: 5846078

## Objetivo

Preparar o pacote completo para criacao manual de ambiente demo municipal isolado, sem criar banco, executar SQL, acessar Supabase ou fazer deploy.

## Arquitetura

A demo usa um banco Supabase isolado e exclusivo. O fluxo municipal usa `institution_id` como prefeitura e `unit_id` como almoxarifado/unidade. O pacote nao usa `project_id`.

## Arquivos

- `backend/src/data/municipal-demo-schema-bundle.sql`
- `backend/src/data/municipal-demo-seed.sql`
- `backend/src/data/municipal-demo-verification.sql`
- `backend/src/data/municipal-demo-cleanup.sql`
- `backend/tests/municipal-demo-bundle-safety.test.js`
- `backend/tests/municipal-demo-seed-safety.test.js`
- `backend/tests/municipal-demo-smoke.test.js`
- `docs/GUIA-CRIACAO-AMBIENTE-DEMO-MUNICIPAL.md`
- `docs/OPERACAO-AMBIENTE-DEMO-MUNICIPAL.md`
- `backend/scripts/municipal-demo-lib.js`
- `backend/scripts/municipal-demo-preflight.js`
- `backend/scripts/municipal-demo-apply-schema.js`
- `backend/scripts/municipal-demo-apply-seed.js`
- `backend/scripts/municipal-demo-verify.js`
- `backend/scripts/municipal-demo-cleanup.js`
- `backend/tests/municipal-demo-provisioning.test.js`
- `docs/RELATORIO-PRONTIDAO-DEMO-MUNICIPAL.md`

## Modulos

- Administracao multi-tenant: instituicoes, unidades, perfis, convites e auditoria.
- Almoxarifado: itens, entradas, saidas, saldo calculado e auditoria operacional.
- Sentinela: analise baseada em estoque, documentos, patrimonio e auditoria.
- Acervo: documentos, versoes e referencia segura.
- Patrimonio: bens individualizados, historico, manutencao, transferencia e baixa.
- Notificacoes: fila `in_app`, deduplicacao e status.
- Auditoria/Timeline: rastreabilidade por `municipal_admin_audit_log` e `stock_audit_log`.

## Protecoes

- Bundle aditivo e idempotente.
- `CREATE TABLE IF NOT EXISTS`.
- `CREATE INDEX IF NOT EXISTS`.
- RLS ativado nas tabelas municipais do pacote.
- Policies idempotentes.
- Nenhum `DROP`, `TRUNCATE`, `DELETE FROM`, `UPDATE` ou `INSERT` de dados no bundle.
- Seed com placeholders obrigatorios para usuarios ficticios.
- Cleanup manual filtrado por `DEMO_MUNICIPAL_`.
- Verificacao somente leitura.
- Ferramentas de provisionamento em dry-run por padrao.
- Escrita bloqueada sem `--execute` e confirmacao literal.
- Execucao automatica de SQL sem executor seguro retorna `automatic_sql_execution_not_configured`.
- WhatsApp e e-mail desativados por padrao.
- Configuracao demo rejeita E2E, producao conhecida e CORS `*`.

## Dados Ficticios

Todos os dados operacionais preparados usam prefixo `DEMO_MUNICIPAL_`.

Incluidos:

- prefeitura demonstrativa;
- tres unidades demonstrativas;
- estoque com saldo normal, baixo e zerado;
- entradas e saidas;
- bens bons, regulares, ruins, em manutencao, transferidos e baixados;
- documentos e versoes do Acervo;
- eventos do Sentinela via auditoria;
- notificacoes `in_app` lidas e nao lidas.

Nao foram incluidos CPF, telefone, e-mail real, prefeitura real, cliente real, IDs E2E ou IDs de producao.

## Testes Planejados

- `municipal-demo-bundle-safety.test.js`
- `municipal-demo-seed-safety.test.js`
- `municipal-demo-smoke.test.js`
- `municipal-demo-config.test.js`
- `municipal-deploy-readiness.test.js`
- `municipal-schema-safety.test.js`

## Resultados

Execucao local concluida na ETAPA 48:

-
ode --check backend/tests/municipal-demo-bundle-safety.test.js: passou
-
ode --check backend/tests/municipal-demo-seed-safety.test.js: passou
-
ode --check backend/tests/municipal-demo-smoke.test.js: passou
-
ode --check backend/src/municipal-demo-config.js: passou
-
ode --check backend/src/app.js: passou
-
ode --test backend/tests/municipal-demo-bundle-safety.test.js: 8/8 passou
-
ode --test backend/tests/municipal-demo-seed-safety.test.js: 5/5 passou
-
ode --test backend/tests/municipal-demo-smoke.test.js: 3/3 passou
-
ode --test backend/tests/municipal-demo-config.test.js: 11/11 passou
-
ode --test backend/tests/municipal-deploy-readiness.test.js: 7/7 passou
-
ode --test backend/tests/municipal-schema-safety.test.js: 7/7 passou


## Matriz de Compatibilidade do Estoque

| Backend real | Bundle demo | Compativel | Evidencia |
| --- | --- | --- | --- |
| `stock_items.id uuid primary key` | `stock_items.id uuid primary key default gen_random_uuid()` | Sim | `backend/src/app.js` usa `.from("stock_items")`; schema base em `backend/src/data/stock-saude-schema.sql`. |
| `stock_items.institution_id` | `uuid not null references public.institutions(id) on delete cascade` | Sim | Queries filtram `.eq("institution_id", session.profile.institution_id)`. |
| `stock_items.unit_id` | `uuid not null references public.units(id) on delete cascade` | Sim | Queries filtram `.eq("unit_id", session.profile.unit_id)` para usuario com unidade. |
| `stock_items.name/category/unit/minimum_quantity/location/batch/expiration_date` | Mesmas colunas, com `minimum_quantity numeric(14, 3)` | Sim | `validateStockSaudeItemPayload_` monta essas colunas; Prateleira/Sentinela leem `minimum_quantity`. |
| `stock_entries.item_id` | `uuid not null references public.stock_items(id) on delete restrict` | Sim | `isStockSaudeItemInProfileScope_` valida item antes da entrada. |
| `stock_entries.quantity` | `numeric(14, 3) not null check (quantity > 0)` | Sim | `validateStockSaudeEntryPayload_` exige `quantity > 0`. |
| `stock_entries.status` | `pendente`, `aprovada`, `rejeitada` | Sim | Criacao usa `pendente`; aprovacao/rejeicao atualizam para status aprovado/rejeitado do fluxo real. |
| `stock_entries.source/invoice_number/requested_by/approved_by/approved_at` | Mesmas colunas e FKs para `profiles` | Sim | Validador e aprovacao usam esses campos. |
| `stock_exits.item_id/quantity/destination_sector/purpose/responsible_name/created_by` | Mesmas colunas; `quantity > 0`; `created_by` referencia `profiles` | Sim | `validateStockSaudeExitPayload_` monta exatamente esses campos. |
| `stock_audit_log.institution_id/unit_id/profile_id/action/entity_type/entity_id/metadata/created_at` | Mesmas colunas; FKs de escopo e perfil | Sim | `createStockSaudeAuditLog_` insere esses campos. |
| Endpoints e consultas | Bundle cria tabelas acessadas por `/api/stock-saude/items`, `/entries`, `/exits`, `/balance`, `/dashboard`, `/audit-log` | Sim | Rotas em `backend/src/app.js` e servicos municipais usam as mesmas tabelas. |
| `operation_id` | Nao existe nas tabelas reais de estoque municipal; verificado apenas em auditoria/relatorios quando presente em metadata | Sim | Busca no backend nao encontrou `operation_id` no contrato `stock_items/entries/exits/audit_log`. |

Correcoes realizadas na ETAPA 48B:

- Removidas colunas extras de `stock_items` no bundle demo (`status` e `created_by`).
- Ajustado `quantity` de entradas/saidas para `numeric(14, 3)` com `check (quantity > 0)`.
- Ajustados status de `stock_entries` para somente `pendente`, `aprovada`, `rejeitada`.
- Restauradas FKs para `profiles` em `requested_by`, `approved_by`, `created_by` e `profile_id`.
- Ajustados indices do estoque para nomes/colunas do schema existente.
- Removida entrada com quantidade zero do seed; item zerado permanece zerado por ausencia de entrada.
- Corrigida ordem de joins do seed para aliases definidos antes do uso.
## Riscos

- O schema de estoque operacional municipal nao possui arquivo dedicado de origem; o bundle inclui um bloco aditivo minimo alinhado ao contrato atual do backend.
- O seed depende da substituicao manual correta dos placeholders de usuarios ficticios.
- A aplicacao manual no Supabase deve ser feita uma unica vez e sempre no banco demo isolado.

## Pendencias Manuais

- Criar banco demo isolado.
- Configurar variaveis seguras.
- Criar usuarios ficticios no Auth demo.
- Substituir placeholders.
- Aplicar bundle.
- Aplicar seed.
- Rodar verificacao.
- Validar painel e offline.
- Registrar evidencias.

## Pronto

- Pacote SQL de schema.
- Seed ficticio.
- Verificacao read-only.
- Cleanup manual.
- Testes de seguranca.
- Guia operacional.

## Nao Executado

- Criacao de banco.
- SQL no Supabase.
- Acesso ao Supabase.
- Supabase CLI.
- Criacao de usuarios.
- Deploy.
- Cleanup.
- Push.

## Decisao Final

PRONTO COM RESSALVA OPERACIONAL
