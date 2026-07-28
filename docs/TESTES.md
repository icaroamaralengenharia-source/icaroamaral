# TESTES

## Visao geral

O repositorio usa tres camadas de validacao:

- Node test runner para backend, motores ELO, stores e servicos.
- Playwright para jornadas E2E de frontend.
- Scripts E2E reais com Supabase isolado para validar fluxo multi-modulo sem usar producao.

A ultima validacao ampla registrada pelo contexto operacional foi uma suite real com 396/396 testes passando. Este documento registra essa referencia e os comandos existentes; nao executa a suite automaticamente.

## Comandos existentes

Na raiz:

```powershell
npm test
npm run test:e2e
npm run build
```

No backend:

```powershell
cd backend
npm test
npm run test:elo:hardening
```

Validar ambiente E2E:

```powershell
node scripts/e2e/validate-e2e-env.mjs --env .env.e2e
```

Preparar tenant E2E:

```powershell
node scripts/e2e/setup-e2e-tenant.mjs --env .env.e2e
```

Cleanup E2E existe, mas nao deve ser executado sem decisao explicita:

```powershell
node scripts/e2e/cleanup-e2e-tenant.mjs --env .env.e2e
```

## Testes unitarios e integracao

Diretorio principal: `backend/tests/`.

Areas cobertas por nomes reais de arquivos:

- ELO: intencao, roteamento, memoria, conversa, conhecimento, dashboard, auditoria, hardening e stress.
- Orcamento: budget engine, EAP, tabela, API, orcamentista v2, precos e pipeline residencial.
- Relatorios/RDO: servico transacional, API, PDF, fotos e duplicidade de materiais.
- Stock: Stock Full frontline, Stock AI real compositions e geometria.
- Supabase/Auth: `auth-context`, isolamento, store core Supabase e login frontend.
- Busca web: `elo-web-search-endpoint.test.js`.

Tambem existem testes `.test.cjs` dentro de `relatorio-qualidade-obras/` para motores que rodam no navegador e no Node.

## Testes E2E

Config: `playwright.config.js`.

- `testDir: "."`.
- `testMatch`: `tests/e2e/**/*.spec.js` e `backend/tests/**/*.e2e.spec.js`.
- baseURL: `http://127.0.0.1:5541`.
- webServer: `npm.cmd run dev -- --host 127.0.0.1 --port 5541`.

Arquivos E2E reais:

- `tests/e2e/almoxarifado.spec.js`
- `tests/e2e/elo-conversation-conductor.spec.js`
- `tests/e2e/elo-mobile-regressions.spec.js`
- `tests/e2e/elo-operational-dashboard.spec.js`
- `tests/e2e/elo-real-journey.spec.js`
- `tests/e2e/elo-stock-obras-briefing.spec.js`
- `tests/e2e/elo-surfaces.spec.js`
- `tests/e2e/site-access-gate.spec.js`
- `tests/e2e/stock-full-saas.spec.js`
- `tests/e2e/real/saas-wide-real.spec.js`
- `backend/tests/report-photo-to-pdf.e2e.spec.js`

## Ambiente Supabase isolado

Documento existente: `docs/e2e-test-environment.md`.

Variaveis obrigatorias por nome:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `E2E_ALLOW_WRITES`
- `E2E_ENVIRONMENT`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `E2E_TENANT_SLUG`
- `E2E_COMPANY_NAME`
- `E2E_CLIENT_NAME`
- `E2E_WORK_NAME`

Nunca registrar valores reais em docs, README, commits ou logs compartilhados.

## Preparacao do tenant

`setup-e2e-tenant.mjs` valida ambiente com `validateE2eEnv` e cria, quando tabelas existem:

- usuario Auth de teste;
- instituicao, unidade, company e profile;
- cliente e obra;
- budget ELO;
- RDO;
- relatorio tecnico;
- produtos e movimentacoes;
- itens, entradas e saidas do Stock Full runtime.

Estado local gerado: `backend/data/e2e-test-state.json`, ignorado pelo Git.

## Validacoes feitas pela suite real

A suite E2E real cobre login, ausencia de textos proibidos, dados de tenant, navegacao por superficies, ELO, Stock Full, documentos, RDO, relatorios e jornada ampla SaaS. A referencia operacional mais recente informou 396/396 PASS.

## Limitacoes atuais

- E2E real depende de Supabase de teste configurado.
- Sem `.env.e2e`, testes reais devem pular ou falhar com seguranca.
- Cleanup existe, mas deve ser acionado deliberadamente.
- CADISTA fica fora da suite principal deste repositorio.
- Nao executar E2E real contra producao.
