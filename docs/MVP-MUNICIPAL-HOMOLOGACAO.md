# MVP Municipal - Homologacao Tecnica

Data: 2026-07-30
Commit base: 05a5b41 feat: cria painel municipal do gestor

## Ambiente auditado

- Raiz Git: `C:/Users/Wia Engenharia/Documents/SaaS Inspeção Técnica/site_repo_icaroamaral`
- Branch: `main`
- Ambiente backend encontrado: arquivo `backend/.env` com Supabase remoto configurado; classificacao: indeterminado para escrita automatica.
- Ambiente E2E encontrado: `.env.e2e` com `E2E_ENVIRONMENT=test` e `E2E_ALLOW_WRITES=true`; classificacao: teste declarado, mas sem comprovacao automatica de schema aplicado nesta etapa.
- Supabase local via CLI: nao identificado por pasta `supabase/` ou `.supabase/` no repositorio.
- Chaves, tokens, senhas e tokens de convite: nao registrados neste documento.

## SQL municipal

- Arquivo: `backend/src/data/municipal-admin-schema.sql`.
- Status nesta execucao: nao aplicado.
- Motivo: ambiente remoto principal indeterminado e ausencia de comprovacao de banco local/homologacao isolado com schema atual.
- Revisao: schema mantido aditivo e idempotente com `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` e `CREATE INDEX IF NOT EXISTS`.
- Operacoes destrutivas: nao ha `DROP TABLE` nem `TRUNCATE`.
- Tenant municipal: `institution_id`.
- Unidade/almoxarifado: `unit_id`.
- Convites: armazenam `token_hash`; token bruto deve existir apenas no retorno imediato da rota.
- Auditoria: `municipal_admin_audit_log.metadata` em `jsonb`, sanitizada no service.
- Hardening adicionado: indices para `email`, `status`, `created_at` e RLS idempotente sem politica `using (true)`.

## Tabelas e indices esperados

Tabelas municipais: `institutions`, `units`, `profiles`, `municipal_admin_invites`, `municipal_admin_audit_log`.

Indices cobertos por teste de schema:

- `institution_id`
- `unit_id`
- `auth_user_id`
- `email`
- `status`
- `token_hash`
- `created_at`

## RLS e isolamento

- Backend municipal usa cliente server-side com `service_role` e valida sessao via `GET /api/municipal-admin/me`.
- Isolamento principal esta no backend: papel, `institution_id`, `unit_id`, convites e alteracoes de usuarios.
- SQL municipal agora habilita RLS em tabelas municipais e cria politicas de leitura por tenant para tabelas compartilhadas.
- Tabelas de convite e auditoria ficam sem politica permissiva direta; uso esperado e via backend service role.
- Nao foi criada politica ampla `using (true)`.

## Platform admin

Metodo preparado: `backend/scripts/set-platform-admin.js`.

Exemplo manual seguro, sem registrar segredo:

```powershell
cd backend
$env:MUNICIPAL_ADMIN_ENVIRONMENT='homologacao'
node scripts/set-platform-admin.js --env .env --email usuario-admin@dominio.test --environment homologacao --confirm PROMOTE_PLATFORM_ADMIN
```

O script:

- exige ambiente `local`, `test`, `homologacao`, `homologation` ou `staging`;
- exige usuario por e-mail ou UUID;
- exige confirmacao literal;
- usa service role apenas server-side;
- mascara e-mail e ID na saida;
- nao cria senha fixa;
- e idempotente via upsert/update de `profiles`.

## Homologacao real das APIs

Preparado teste opt-in: `backend/tests/municipal-admin-real.test.js`.

- Ignorado por padrao.
- So roda com `RUN_MUNICIPAL_REAL_TESTS=1` e variaveis reais de homologacao.
- Nesta execucao, o teste real nao foi executado porque nao houve autorizacao/comprovacao de ambiente real controlado nem tokens reais de usuarios de teste.

## Frontend

- Painel: `municipal-admin.html` e `relatorio-qualidade-obras/municipal-admin-ui.js`.
- E2E isolado com mocks validou: sem token, `platform_admin`, `municipal_admin`, `gestor`, papel inferior, falha parcial, desktop, tablet e mobile.
- Nao foi declarada homologacao frontend contra backend real nesta execucao.

## Testes executados nesta etapa

- `node scripts/e2e/validate-e2e-env.mjs --env .env.e2e`: passou; ambiente E2E marcado como teste, Supabase remoto nao classificado pelo nome.
- `node --check backend/src/municipal-admin-service.js`: passou.
- `node --check backend/src/municipal-admin-router.js`: passou.
- `node --check relatorio-qualidade-obras/municipal-admin-ui.js`: passou.
- `node --check backend/scripts/set-platform-admin.js`: passou.
- `node --check backend/tests/municipal-admin-schema.test.js`: passou.
- `node --check backend/tests/municipal-admin-real.test.js`: passou.
- `node --check tests/e2e/municipal-admin-ui.spec.js`: passou.
- `node --test backend/tests/municipal-admin.test.js`: 8 passed.
- `node --test backend/tests/municipal-admin-isolation.test.js`: 2 passed.
- `node --test backend/tests/auth-context.test.js`: 3 passed.
- `node --test backend/tests/municipal-admin-schema.test.js backend/tests/municipal-admin-real.test.js`: 3 passed, 1 skipped por `RUN_MUNICIPAL_REAL_TESTS` ausente.
- `node --test --test-name-pattern "Stock Saude|stock-saude|convite" backend/tests/ai-endpoint.test.js`: 8 passed.
- `node --test backend/tests/elo-auth-isolation.test.js`: 2 passed.
- `node node_modules/@playwright/test/cli.js test tests/e2e/stock-full-saas.spec.js --grep "admin e funcionario respeitam permissoes centrais|modo online real escolhe backend"`: 2 passed.
- `node node_modules/@playwright/test/cli.js test --grep "Administracao Municipal UI"`: 21 passed.
- `git diff --check`: passou.

## Rollback seguro

- Como SQL nao foi aplicado, rollback de banco nao foi necessario.
- Para codigo, usar commit anterior conhecido apos revisao humana; nao usar reset destrutivo sem autorizacao.
- Se o SQL for aplicado em homologacao e precisar desfazer, preferir desativar dados `HOMOLOGACAO_` criados nos testes; nao apagar dados reais.

## Criterio para deploy

Antes de deploy/producao:

1. Aplicar schema somente em homologacao comprovada.
2. Configurar `platform_admin` por script administrativo ou SQL parametrizado.
3. Executar fluxo ponta a ponta real com usuarios de teste.
4. Validar painel contra backend real em desktop e celular.
5. Confirmar bloqueio de anon/direto e acessos cruzados.
6. Registrar evidencias sem segredos.

## Decisao desta execucao

`MVP_TECNICO_PRONTO_PARA_HOMOLOGACAO_MANUAL`

Motivo: codigo, schema, script e testes opt-in estao preparados; SQL e fluxo real nao foram executados porque o ambiente seguro ainda precisa ser comprovado manualmente.