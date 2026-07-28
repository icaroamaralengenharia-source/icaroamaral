# Sistema SaaS/ELO

Este repositorio contem a plataforma publica e operacional da Icaro Amaral Engenharia, com paginas Vite, backend Express, modulos de estoque, relatorios tecnicos, RDO, orcamento e o assistente ELO.

## Proposito

O sistema apoia rotinas de engenharia, obras, estoque e atendimento assistido por IA. O ELO funciona como camada transversal de conversa, roteamento, memoria e apoio tecnico. Stock Obras esta documentado como modulo estavel de piloto tecnico e nao deve ser alterado sem nova auditoria. CADISTA existe neste repositorio como prototipo/experimento publicado em `cadista/`, mas o projeto CADISTA principal deve ser tratado separadamente em `cadista_ia`.

## Modulos existentes

| Modulo | Entrada principal | Status registrado |
| --- | --- | --- |
| ELO Brain | `elo.html`, `backend/src/app.js` | publicado, transversal, SaaS parcial |
| ObraReport | `relatorio-qualidade-obras/relatorio-qualidade-obras.html` | piloto publicado |
| Stock Obras | `stock-ai-obras.html`, `stock-ai-obras-bridge.js` | piloto tecnico estavel |
| Stock Full | `stockfull.html`, `stock-full-*.js`, `/api/stock-full/*` | piloto SaaS |
| Stock Saude | `stock-saude.html`, `stock-saude.js`, `/api/stock-saude/*` | piloto funcional controlado |
| RDO e relatorios | `backend/src/services/obrareport-transactional-service.js` | backend transacional local/Supabase E2E |
| Orcamentos ELO | `backend/src/services/elo-budget-service.js` | backend com geracao HTML/PDF adapter |
| CADISTA | `cadista/`, `cadista-login.html` | separado e experimental |

## Requisitos

- Node.js compativel com Vite 5 e Node test runner.
- npm.
- Navegador Chromium para Playwright.
- Projeto Supabase isolado apenas para E2E real.
- Variaveis de ambiente configuradas localmente, sem versionar valores reais.

## Instalacao

Na raiz:

```powershell
npm install
```

No backend:

```powershell
cd backend
npm install
```

## Execucao frontend

```powershell
npm run dev
```

URL padrao do script:

```text
http://127.0.0.1:5500/
```

O Playwright usa servidor Vite em `http://127.0.0.1:5541/relatorio-qualidade-obras.html` quando executado por `npm run test:e2e`.

## Execucao backend

```powershell
cd backend
npm run dev
```

Servidor Express:

```text
http://localhost:3000
```

Health check:

```text
GET /api/health
```

## Estrutura principal

```text
assets/                         portao de acesso e configuracao publica
backend/src/app.js              aplicacao Express e rotas HTTP
backend/src/data/               schemas SQL e bases demonstrativas
backend/src/services/           servicos transacionais de relatorio/RDO/orcamento
backend/tests/                  testes unitarios e integracao do backend/ELO
relatorio-qualidade-obras/      ObraReport, ELO operacional e motores tecnicos
scripts/e2e/                    validacao, setup, schema e cleanup E2E
tests/e2e/                      jornadas Playwright
tests/platform/                 testes de roteamento/modulos da plataforma
src/platform/                   registry de modulos e roteador de segmentos
docs/                           documentacao tecnica e operacional
cadista/                        prototipo CADISTA separado/experimental
```

## Testes

Backend unitario/integracao:

```powershell
cd backend
npm test
```

Atalho da raiz para testes backend `.test.js`:

```powershell
npm test
```

E2E Playwright:

```powershell
npm run test:e2e
```

Validacao do ambiente E2E:

```powershell
node scripts/e2e/validate-e2e-env.mjs --env .env.e2e
```

Setup E2E, somente em Supabase isolado:

```powershell
node scripts/e2e/setup-e2e-tenant.mjs --env .env.e2e
```

Nunca execute E2E real contra producao.

## Documentacao

- `docs/ARQUITETURA.md`
- `docs/FLUXOS-REAIS.md`
- `docs/TESTES.md`
- `docs/DEPLOY-E-AMBIENTES.md`
- `docs/PENDENCIAS-E-ROADMAP.md`
- `docs/INVENTARIO-TECNICO.md`
- `docs/e2e-test-environment.md`
- `docs/render-backend-deploy.md`
- `docs/stock-full-runtime-schema.md`

## Seguranca

Nao versionar `.env.e2e`, `backend/.env`, senhas, tokens, cookies, chaves Supabase, Bearer ou qualquer segredo. Use apenas arquivos `.example` e documentos que listem nomes de variaveis, nunca valores.
