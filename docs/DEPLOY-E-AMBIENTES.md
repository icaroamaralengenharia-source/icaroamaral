# DEPLOY E AMBIENTES

## Ambiente local

Frontend:

```powershell
npm install
npm run dev
```

Backend:

```powershell
cd backend
npm install
npm run dev
```

Portas reais dos scripts:

- frontend local: `127.0.0.1:5500`.
- backend: `PORT` ou `3000`.
- Playwright: `127.0.0.1:5541`.

## Ambiente E2E

E2E deve usar projeto Supabase isolado. A validacao bloqueia ambiente inseguro em `scripts/e2e/validate-e2e-env.mjs`.

Ordem segura:

1. Criar projeto Supabase exclusivo de teste.
2. Aplicar `scripts/e2e/prepare-e2e-schema.sql`.
3. Criar `.env.e2e` local a partir de `.env.e2e.example`.
4. Validar com `node scripts/e2e/validate-e2e-env.mjs --env .env.e2e`.
5. Rodar `node scripts/e2e/setup-e2e-tenant.mjs --env .env.e2e`.
6. Rodar E2E com `npm run test:e2e`.
7. Executar cleanup apenas com autorizacao explicita.

## Ambiente de producao

O repositorio contem `docs/render-backend-deploy.md` e `backend/DEPLOY.md`. O backend e um app Node/Express iniciado por `backend/src/server.js`. O frontend e buildado com Vite por `npm run build`.

Producao nao deve compartilhar Supabase, usuarios, tenant ou secrets com E2E.

## Variaveis necessarias por nome

Backend/IA/Supabase, conforme arquivos existentes e scripts:

- `PORT`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `AI_ALLOWED_ORIGINS`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

E2E:

- `E2E_ALLOW_WRITES`
- `E2E_ENVIRONMENT`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `E2E_TENANT_SLUG`
- `E2E_COMPANY_NAME`
- `E2E_CLIENT_NAME`
- `E2E_WORK_NAME`

Nao registrar valores reais nesta documentacao.

## Migracoes e schemas

Arquivos SQL reais:

- `backend/src/data/stock-full-runtime-schema.sql`
- `backend/src/data/stock-full-saas-schema.sql`
- `backend/src/data/stock-full-schema.sql`
- `backend/src/data/stock-saude-schema.sql`
- `backend/src/data/obrareport-runtime-schema.sql`
- `backend/src/data/elo-budget-runtime-schema.sql`
- `backend/src/data/elo-core-supabase-migration.sql`
- `scripts/e2e/prepare-e2e-schema.sql`

Ordem segura recomendada para E2E: aplicar `scripts/e2e/prepare-e2e-schema.sql`, pois ele consolida tabelas usadas pela suite real.

## Processo de deploy

1. Conferir `git status`.
2. Rodar testes locais necessarios.
3. Rodar `npm run build`.
4. Configurar variaveis de ambiente na plataforma de hospedagem, nunca em arquivo publicado.
5. Publicar frontend gerado em `dist/` conforme configuracao Vite.
6. Publicar backend Node apontando para `backend/src/server.js`.
7. Conferir `GET /api/health`.
8. Conferir paginas principais: `index.html`, `relatorio-qualidade-obras/relatorio-qualidade-obras.html`, `elo.html`, `stockfull.html`.

## Verificacao pos-deploy

- `GET /api/health` retorna ok.
- Rotas publicas carregam sem erro JS critico.
- Portao de acesso frontend carrega `assets/site-access-gate.js` e `assets/site-access-gate.css`.
- Backend nao expõe secrets em resposta.
- Operacoes autenticadas falham com 401/403 quando sem Bearer valido.

## Rollback

Rollback deve voltar para commit/tag conhecido e variaveis de ambiente anteriores. Nao usar `git reset`, `checkout` ou alteracoes destrutivas sem plano e autorizacao explicita.

## Proibicoes

- Nao compartilhar `.env.e2e` ou `backend/.env`.
- Nao enviar chaves Supabase, tokens, cookies, Bearer ou senhas por chat, commit, README ou docs.
- Nao usar producao para E2E.
- Nao executar cleanup em producao.
