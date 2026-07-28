# ARQUITETURA

Documento baseado no estado atual do repositorio `site_repo_icaroamaral`.

## Frontend

O frontend e composto por paginas HTML/CSS/JS servidas por Vite. As entradas principais ficam na raiz e em subpastas:

- `index.html`: pagina principal publica.
- `elo.html`, `elo.css`, `elo-projeto.html`: superficie do ELO.
- `relatorio-qualidade-obras/relatorio-qualidade-obras.html`: ObraReport.
- `stock-ai-obras.html`, `stock-ai-obras-bridge.js`, `stock-ai.css`, `stock-ai.html`: Stock Obras e ponte com ELO.
- `stockfull.html`, `stock-full-*.js`, `stock-full-app.html`: Stock Full.
- `stock-saude.html`, `stock-saude.js`, `stock-saude-app.html`: Stock Saude.
- `assets/site-access-gate.js` e `assets/site-access-gate.css`: portao frontend de acesso.
- `src/platform/module-registry.js`: registro real dos modulos publicados/prototipos.
- `src/platform/segment-router.js`: recomendacao de segmento por texto.

## Backend

O backend usa Express em `backend/src/app.js`, iniciado por `backend/src/server.js`. O servidor carrega `dotenv/config`, escuta `PORT` ou `3000` e registra rotas dentro de `createApp(options)`.

Arquivos centrais:

- `backend/src/app.js`: rotas HTTP, interpretacao do ELO, IA, fallback local, Stock Full/Stock Saude e integracao com servicos.
- `backend/src/auth-context.js`: resolve usuario Supabase via Bearer, busca `profiles` e retorna `institutionId`, `companyId`, `role` e `profile`.
- `backend/src/supabase.js`: cria cliente Supabase server-side usando `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` quando presentes.
- `backend/src/services/obrareport-transactional-service.js`: CRUD local transacional para relatorios tecnicos, RDOs, versoes, eventos, documentos HTML e preparo de email.
- `backend/src/services/elo-budget-service.js`: CRUD local para orcamentos ELO, versoes, eventos e geracao de documento HTML via adapter do `elo-assistente.js`.
- `backend/src/elo-core-store.js`: conversas, mensagens e memorias em JSON local.
- `backend/src/elo-core-supabase-store.js`: conversas, mensagens e memorias usando Supabase com JWT do usuario.
- `backend/src/elo-projects-store.js`: store local para projetos ELO.
- `backend/src/elo-obra-observer.js`: observacao/alertas de obra.

## Rotas reais do backend

### Saude e IA

- `GET /api/health`
- `POST /api/ai/improve-text`
- `POST /api/ai/analyze-image`

### ObraReport e RDO

- `POST /api/obrareport/reports`
- `GET /api/obrareport/reports`
- `GET /api/obrareport/reports/:id`
- `PUT /api/obrareport/reports/:id`
- `POST /api/obrareport/reports/:id/versions`
- `POST /api/obrareport/reports/:id/generate-document`
- `GET /api/obrareport/reports/:id/events`
- `POST /api/obrareport/rdos`
- `GET /api/obrareport/rdos`
- `PUT /api/obrareport/rdos/:id`
- `POST /api/obrareport/rdos/:id/versions`
- `POST /api/obrareport/rdos/:id/generate-document`
- `GET /api/obrareport/rdos/:id/events`
- `POST /api/obrareport/documents/:id/prepare-email`

### Stock Demo

- `GET /api/stock-demo/health`
- `GET /api/stock-demo/state`
- `POST /api/stock-demo/state`
- `POST /api/stock-demo/approval-requests`
- `POST /api/stock-demo/approval-requests/:id/approve`
- `POST /api/stock-demo/approval-requests/:id/reject`

### Stock Full

- `GET /api/stock-full/health`
- `GET /api/stock-full/me`
- `GET /api/stock-full/items`
- `POST /api/stock-full/items`
- `PUT /api/stock-full/items/:id`
- `DELETE /api/stock-full/items/:id`
- `GET /api/stock-full/entries`
- `POST /api/stock-full/entries`
- `GET /api/stock-full/exits`
- `POST /api/stock-full/exits`
- `GET /api/stock-full/audit-log`

### Stock Saude

- `GET /api/stock-saude/health`
- `GET /api/stock-saude/me`
- `GET /api/stock-saude/items`
- `POST /api/stock-saude/items`
- `GET /api/stock-saude/entries`
- `POST /api/stock-saude/entries`
- `POST /api/stock-saude/entries/:id/approve`
- `POST /api/stock-saude/entries/:id/reject`
- `GET /api/stock-saude/exits`
- `POST /api/stock-saude/exits`
- `GET /api/stock-saude/balance`
- `GET /api/stock-saude/dashboard`
- `GET /api/stock-saude/audit-log`
- `GET /api/stock-saude/invites`
- `POST /api/stock-saude/invites`
- `POST /api/stock-saude/invites/accept`

### ELO, memoria e orcamento

- `GET /api/elo/obra/attention`
- `POST /api/elo/web-search`
- `GET /api/elo/budgets`
- `POST /api/elo/budgets`
- `GET /api/elo/budgets/:id`
- `PUT /api/elo/budgets/:id`
- `POST /api/elo/budgets/:id/versions`
- `POST /api/elo/budgets/:id/generate-pdf`
- `GET /api/elo/budgets/:id/events`
- `GET /api/elo/budgets/:id/documents`
- `GET /api/elo/conversations`
- `POST /api/elo/conversations`
- `GET /api/elo/conversations/:id`
- `PUT /api/elo/conversations/:id`
- `POST /api/elo/conversations/:id/messages`
- `POST /api/elo/identity/merge`
- `GET /api/elo/memories`
- `POST /api/elo/memories`
- `PUT /api/elo/memories/:id`
- `DELETE /api/elo/memories/:id`
- `DELETE /api/elo/memories`
- `POST /api/elo/vector-memory`
- `POST /api/elo/chat`

## Supabase

Supabase aparece em tres camadas:

- Cliente server-side com service role em `backend/src/supabase.js`.
- Autenticacao por Bearer em `backend/src/auth-context.js`.
- Store Supabase do ELO em `backend/src/elo-core-supabase-store.js`, usando JWT do usuario e anon key.

Schemas SQL reais:

- `backend/src/data/stock-full-runtime-schema.sql`
- `backend/src/data/stock-full-saas-schema.sql`
- `backend/src/data/stock-full-schema.sql`
- `backend/src/data/stock-saude-schema.sql`
- `backend/src/data/obrareport-runtime-schema.sql`
- `backend/src/data/elo-budget-runtime-schema.sql`
- `backend/src/data/elo-core-supabase-migration.sql`
- `scripts/e2e/prepare-e2e-schema.sql`

## Autenticacao

O backend resolve sessao por `Authorization: Bearer ...` em `resolveAuthContext(request, options)`. O token e validado por `supabase.auth.getUser(token)`. Depois o backend busca `profiles` por `auth_user_id` e deriva fronteiras de tenant por `institution_id` e `company_id`.

## ELO

Funcoes exportadas em `backend/src/app.js` incluem:

- `normalizeEloText`
- `detectEloIntent`
- `detectEloProjectContext`
- `interpretEloUserMessage`
- `routeEloRequest_`
- `buildEloLocalFallbackResponse_`
- `detectConstructionQuantityIntent_`
- `buildSafeConstructionQuantityResponse_`
- `buildConversationSummary_`
- `createEloVectorMemoryStore_`
- `buildEloSystemPrompt_`
- `searchPathologyKnowledge`
- `buildPathologyContext`
- `formatImageAnalysis_`

O ELO integra conversa, memoria, busca web, orcamento, quantitativo, patologias e roteamento para modulos.

## Stock Obras

Stock Obras esta registrado em `src/platform/module-registry.js` como `stock-obras`, rota `/stock-ai-obras.html`, status `stable_pilot`. Arquivos principais:

- `stock-ai-obras.html`
- `stock-ai-obras-bridge.js`
- `stock-ai.css`
- `stock-ai.html`
- docs de bases reais em `docs/stock-ai-*.md`
- testes relacionados em `backend/tests/stock-ai-*.test.js` e `tests/e2e/elo-stock-obras-briefing.spec.js`

Nao propor alteracoes neste modulo sem nova auditoria.

## Stock Full

Stock Full tem frontend em `stockfull.html`, `stock-full-*.js` e backend em `/api/stock-full/*`. Usa schemas `stock-full-runtime-schema.sql`, `stock-full-saas-schema.sql` e `stock-full-schema.sql`. O status no registry e `saas_pilot`, `saasReady: true`.

## RDO e relatorios

RDO e relatorios usam `createObraReportTransactionalService` com armazenamento JSON local por padrao e schema SQL `obrareport-runtime-schema.sql` para runtime persistente. O servico cria relatorios, RDOs, versoes, eventos, documentos HTML controlados e preparo de email sem envio real.

## Orcamento

Orcamento ELO usa `createEloBudgetService`, `elo-budget-runtime-schema.sql` e rotas `/api/elo/budgets*`. A geracao de documento chama adapter carregado de `relatorio-qualidade-obras/elo-assistente.js`.

## Memoria

A memoria do ELO existe em duas implementacoes:

- `createEloCoreStore`: fallback local em `backend/data/elo-core.json`.
- `createEloCoreSupabaseStore`: tabelas `elo_conversations`, `elo_messages`, `elo_memories`.

Ambas bloqueiam conteudo sensivel em memorias/mensagens conforme regex interna.

## Busca web

A rota real e `POST /api/elo/web-search`. Existem testes relacionados em `backend/tests/elo-web-search-endpoint.test.js` e documentacao de stress em `STRESSTEST_GOOGLE_OBRAS_SINAPI.md`.

## CADISTA separado

Neste repositorio ha arquivos `cadista/` e `cadista-login.html`, registrados como `cadista` com status `prototype` em `src/platform/module-registry.js`. Para desenvolvimento principal, o CADISTA deve ser tratado como projeto separado em `cadista_ia`, fora da suite principal deste repositorio.

## Fluxo de dados entre modulos

1. Frontend HTML/JS coleta acao do usuario.
2. Quando ha backend, chama `backend/src/app.js` por `/api/*`.
3. `auth-context.js` resolve usuario/tenant quando a rota exige contexto autenticado.
4. Servicos locais ou Supabase registram estado.
5. ELO pode rotear intencoes para orcamento, relatorio, estoque, memoria, busca web ou fallback local.
6. Documentos sao gerados como HTML/PDF adapter e registrados por eventos.
