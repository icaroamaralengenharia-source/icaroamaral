# Ambiente E2E Real e Isolado

Este fluxo prepara dados reais para validar documentos do ELO sem tocar em producao.

## Regra de seguranca

Use somente um projeto Supabase exclusivo de teste. Os scripts bloqueiam execucao quando:

- `E2E_ENVIRONMENT` nao for `test`;
- `E2E_ALLOW_WRITES` nao for `true`;
- `E2E_TENANT_SLUG` nao comecar com `elo-e2e-`;
- `E2E_ADMIN_EMAIL` nao usar dominio reservado de teste, como `admin@elo-e2e.test`;
- `SUPABASE_URL` parecer producao;
- qualquer variavel obrigatoria estiver ausente.

Os scripts nunca imprimem senha, token anon ou service role.

## Variaveis

Copie `.env.e2e.example` para `.env.e2e` e preencha:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
E2E_ALLOW_WRITES=true
E2E_ENVIRONMENT=test
E2E_ADMIN_EMAIL=admin@elo-e2e.test
E2E_ADMIN_PASSWORD=
E2E_TENANT_SLUG=elo-e2e-local
E2E_COMPANY_NAME=ELO TESTE INTEGRADO
E2E_CLIENT_NAME=CLIENTE TESTE E2E
E2E_WORK_NAME=OBRA TESTE E2E
```

O dominio do email deve terminar em `.test`. Exemplo valido: `admin@elo-e2e.test`.

## Validar ambiente

```powershell
node scripts/e2e/validate-e2e-env.mjs --env .env.e2e
```

Sem `.env.e2e` configurado, o comando falha de proposito.

## Setup

```powershell
node scripts/e2e/setup-e2e-tenant.mjs --env .env.e2e
```

O setup cria, quando as tabelas existem no projeto de teste:

- usuario Auth de teste;
- instituicao/tenant;
- company;
- profile admin;
- cliente e obra ObraReport;
- produtos e movimentacoes de estoque;
- orcamento, RDO e relatorio tecnico base.

O arquivo de estado fica em `backend/data/e2e-test-state.json`, que ja esta ignorado pelo Git. Ele guarda apenas IDs nao sensiveis.

## Cleanup

```powershell
node scripts/e2e/cleanup-e2e-tenant.mjs --env .env.e2e
```

O cleanup remove somente registros associados ao tenant criado pelo setup. Ele nao usa `TRUNCATE`, `DROP` nem `DELETE` sem filtro. O usuario Auth e removido por ultimo.

## Jornada E2E

```powershell
node_modules\.bin\playwright.cmd test tests/e2e/elo-real-journey.spec.js --project=chromium
```

Se o ambiente nao estiver configurado, o teste fica marcado como skipped.
