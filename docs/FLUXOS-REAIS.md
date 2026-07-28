# FLUXOS REAIS

Este documento descreve fluxos observados no estado atual. Ele nao define comportamento novo.

## Login

Fluxo backend real:

1. Cliente envia `Authorization: Bearer ...` para rotas que precisam de contexto.
2. `backend/src/auth-context.js` extrai o Bearer.
3. `resolveAuthContext` chama `supabase.auth.getUser(token)`.
4. O backend busca `profiles` por `auth_user_id`.
5. O contexto retorna `userId`, `institutionId`, `companyId`, `role` e `profile`.

Bloqueios esperados:

- sem Bearer: `authentication_required`.
- token invalido: `invalid_session`.
- sem profile: `auth_context_profile_not_found`.
- Supabase ausente: `auth_context_database_not_configured`.

## Criacao e selecao de empresa/obra

No E2E real, `scripts/e2e/setup-e2e-tenant.mjs` cria dados de tenant quando as tabelas existem:

- usuario Auth de teste;
- `institutions`;
- `units`;
- `companies`;
- `profiles`;
- `obrareport_clients`;
- `obrareport_projects`.

No runtime do ObraReport, os registros transacionais usam `institution_id`, `project_id` e `client_id` como fronteiras logicas em `createObraReportTransactionalService`.

## Atendimento pelo ELO

Entrada principal:

- frontend: `elo.html` e componentes em `relatorio-qualidade-obras/elo-assistente.js`;
- backend: `POST /api/elo/chat`.

Funcoes reais envolvidas:

- `interpretEloUserMessage`;
- `detectEloIntent`;
- `detectEloProjectContext`;
- `routeEloRequest_`;
- `buildEloLocalFallbackResponse_`;
- `buildEloSystemPrompt_`.

Erros/bloqueios esperados incluem fallback local quando a IA externa ou integracao nao estiver disponivel.

## Quantitativo

O fluxo de quantitativo passa pelo ELO e pelos motores residenciais/tecnicos existentes em `relatorio-qualidade-obras/` e `backend/src/app.js`:

- `detectConstructionQuantityIntent_`;
- `buildSafeConstructionQuantityResponse_`;
- `extractQuantidadeServico`;
- `relatorio-qualidade-obras/elo-residential-quantity-takeoff-engine.js`;
- `relatorio-qualidade-obras/elo-residential-geometry-model-engine.js`;
- `relatorio-qualidade-obras/elo-technical-service-pdf.js`.

## Orcamento

Rotas reais:

- `GET /api/elo/budgets`;
- `POST /api/elo/budgets`;
- `GET /api/elo/budgets/:id`;
- `PUT /api/elo/budgets/:id`;
- `POST /api/elo/budgets/:id/versions`;
- `POST /api/elo/budgets/:id/generate-pdf`;
- `GET /api/elo/budgets/:id/events`;
- `GET /api/elo/budgets/:id/documents`.

Servico real: `backend/src/services/elo-budget-service.js`.

Dados persistidos localmente por padrao: `backend/data/elo-budgets.json`.

Schema SQL: `backend/src/data/elo-budget-runtime-schema.sql`.

## Entrada e saida de estoque

Stock Full:

- entradas: `GET/POST /api/stock-full/entries`;
- saidas: `GET/POST /api/stock-full/exits`;
- itens: `GET/POST/PUT/DELETE /api/stock-full/items/:id`;
- auditoria: `GET /api/stock-full/audit-log`.

Stock Saude:

- entradas: `GET/POST /api/stock-saude/entries`;
- aprovacao: `POST /api/stock-saude/entries/:id/approve`;
- rejeicao: `POST /api/stock-saude/entries/:id/reject`;
- saidas: `GET/POST /api/stock-saude/exits`;
- saldo/dashboard/auditoria: `/balance`, `/dashboard`, `/audit-log`.

Stock Obras:

- frontend estavel em `stock-ai-obras.html` e `stock-ai-obras-bridge.js`;
- integracao com ELO registrada como `stock-obras` no registry;
- nao ha rota backend dedicada `/api/stock-obras/*` registrada no estado atual.

## RDO

Rotas reais:

- `POST /api/obrareport/rdos`;
- `GET /api/obrareport/rdos`;
- `PUT /api/obrareport/rdos/:id`;
- `POST /api/obrareport/rdos/:id/versions`;
- `POST /api/obrareport/rdos/:id/generate-document`;
- `GET /api/obrareport/rdos/:id/events`.

Servico real: `createObraReportTransactionalService`.

## Relatorio tecnico

Rotas reais:

- `POST /api/obrareport/reports`;
- `GET /api/obrareport/reports`;
- `GET /api/obrareport/reports/:id`;
- `PUT /api/obrareport/reports/:id`;
- `POST /api/obrareport/reports/:id/versions`;
- `POST /api/obrareport/reports/:id/generate-document`;
- `GET /api/obrareport/reports/:id/events`.

Documentos gerados sao HTML controlado no servico local. O envio de email e preparado por `POST /api/obrareport/documents/:id/prepare-email`, mas o proprio servico retorna que envio real depende de provedor configurado.

## Geracao de documentos

- RDO: `generateRdoDocument`.
- Relatorio tecnico: `generateTechnicalReportDocument`.
- Orcamento ELO: `generateBudgetPdf`.
- Auditoria PDF: `scripts/pdf-audit-guards.mjs` e testes `backend/tests/pdf-audit-guards.test.js`.

## Busca web

Rota real:

- `POST /api/elo/web-search`.

Teste relacionado:

- `backend/tests/elo-web-search-endpoint.test.js`.

Documento de stress:

- `STRESSTEST_GOOGLE_OBRAS_SINAPI.md`.

## Erros e bloqueios esperados

- Ambiente Supabase nao configurado: rotas autenticadas podem responder erro de configuracao.
- Falta de Bearer: bloqueio de autenticacao.
- Profile ausente: bloqueio de perfil.
- Memoria com dado sensivel: `sensitive_memory_blocked`.
- Mensagem com dado sensivel sem permissao explicita: `sensitive_message_blocked`.
- Ambiente E2E inseguro: `validate-e2e-env.mjs` falha.
- Setup E2E com tabelas ausentes: script registra `table_missing` e continua quando aplicavel.
- Busca/IA externas indisponiveis: fallback local quando implementado.
