# Relatorio Etapa 52 Demo Real

Data: 2026-08-01

## Estado Inicial

- Branch esperada: `main`
- HEAD esperado: `76c959c`
- Origin sincronizado antes da etapa anterior
- Stress local/mockado aprovado
- Ambiente demo real ainda nao existe

## Objetivo

Preparar a homologacao final contra banco e RLS reais, sem tocar em E2E ou producao e sem executar operacoes live nesta etapa.

## Arquivos Criados

- `backend/tests/municipal-demo-live-preflight.test.js`
- `backend/tests/municipal-demo-live-rls.test.js`
- `backend/tests/municipal-demo-live-concurrency.test.js`
- `tests/e2e/municipal-demo-live.spec.js`
- `backend/src/data/municipal-demo-live-verification.sql`
- `docs/CHECKLIST-HOMOLOGACAO-DEMO-REAL.md`
- `docs/RELATORIO-ETAPA-52-DEMO-REAL.md`

## Cenarios Preparados

### Preflight Live

- `APP_ENV=demo` obrigatorio.
- `MUNICIPAL_DEMO_MODE=true` obrigatorio.
- `RUN_DEMO_LIVE_TESTS=true` exigido para qualquer live.
- `DEMO_PROJECT_REF`, `DEMO_SUPABASE_URL` e `DEMO_DATABASE_URL` obrigatorios.
- URL e project ref devem corresponder.
- E2E e projeto proibido bloqueados.
- HTTPS obrigatorio.
- Localhost remoto rejeitado.
- CORS `*` rejeitado.
- WhatsApp/e-mail desligados.
- Credenciais no frontend rejeitadas.
- Logs sanitizados.

### RLS Real

Foram preparados cenarios para:

- platform_admin;
- municipal_admin;
- gestor da unidade A;
- gestor da unidade B;
- leitura;
- sessao ausente;
- sessao expirada.

As matrizes locais verificam escopo por instituicao/unidade, bloqueio de `project_id`, leitura sem escrita e ausencia de service role no navegador.

### Concorrencia Real

Foram preparados cenarios com limite maximo de 20 operacoes concorrentes:

- entradas simultaneas;
- saidas simultaneas;
- `operation_id` repetido;
- saida maior que saldo;
- tombamento duplicado;
- `deduplication_key` repetida;
- versoes concorrentes;
- transferencia patrimonial concorrente.

Todos os cenarios sao planejados sem retry automatico, uma execucao por cenario e timeout controlado.

### Painel Live

A spec Playwright cobre, quando a flag live for ativada manualmente:

- login;
- Visao Geral;
- estoque;
- patrimonio;
- Sentinela;
- notificacoes;
- relatorios;
- Acervo;
- ELO;
- offline;
- logout/troca de usuario;
- desktop, tablet e celular;
- falha parcial;
- contador de notificacoes;
- ausencia de IDs/segredos.

Sem `RUN_DEMO_LIVE_TESTS=true`, todos os testes ficam skipped antes de navegar.

## Travas Implementadas

- Nenhum teste live roda sem flag.
- Nenhuma conexao e aberta nos testes locais.
- E2E `mplpzyalcxhhinuvjthx` bloqueado.
- Projeto proibido `lidueokjpzxdybtongbk` bloqueado.
- `project_id` rejeitado nas matrizes.
- Prefixo `DEMO_MUNICIPAL_LIVE_52_` obrigatorio nos cenarios.
- Concorrencia maxima: 20.
- Retry automatico: proibido.
- Service role nao e preparada para navegador.
- Verification SQL contem somente `SELECT`, `WITH` e comentarios.
- WhatsApp/e-mail permanecem desligados.
- Package scripts demo nao habilitam live por padrao.

## Testes Locais

Executados nesta etapa:

- `node --check backend/tests/municipal-demo-live-preflight.test.js`: passou
- `node --check backend/tests/municipal-demo-live-rls.test.js`: passou
- `node --check backend/tests/municipal-demo-live-concurrency.test.js`: passou
- `node --check tests/e2e/municipal-demo-live.spec.js`: passou
- `node --test backend/tests/municipal-demo-live-preflight.test.js`: 10/10 passou
- `node --test backend/tests/municipal-demo-live-rls.test.js`: 16/16 passou, incluindo preflight importado
- `node --test backend/tests/municipal-demo-live-concurrency.test.js`: 16/16 passou, incluindo preflight importado
- `npx.cmd playwright test tests/e2e/municipal-demo-live.spec.js --workers=1 --reporter=line`: 4 skipped/bloqueados sem `RUN_DEMO_LIVE_TESTS=true`
- `node --test backend/tests/municipal-demo-provisioning.test.js`: 15/15 passou
- `node --test backend/tests/municipal-demo-dry-run.test.js`: 13/13 passou
- `node --test backend/tests/municipal-demo-bundle-safety.test.js`: 8/8 passou
- `node --test backend/tests/municipal-schema-safety.test.js`: 7/7 passou

Total dos comandos executados: 85 testes locais aprovados e 4 testes Playwright skipped/bloqueados. Unicos novos de backend: 22 cenarios locais preparados.

## Testes Live Nao Executados

Nao foram executados:

- conexao com Supabase;
- SQL no banco;
- testes RLS reais;
- testes de concorrencia reais;
- painel live contra deploy real;
- cleanup;
- criacao de usuarios;
- deploy.

## Dados Necessarios Para Etapa Futura

- Project ref demo isolado;
- Supabase URL demo HTTPS;
- database URL demo segura;
- URL HTTPS do painel demo;
- usuarios ficticios para platform_admin, municipal_admin, gestor A, gestor B e leitura;
- confirmacao de WhatsApp/e-mail desligados;
- hashes dos SQLs aplicados;
- evidencia da aplicacao manual.

## Sequencia Manual Futura

1. Criar projeto demo isolado manualmente.
2. Configurar variaveis fora do Git.
3. Criar usuarios ficticios.
4. Aplicar bundle demo manualmente.
5. Aplicar seed demo manualmente.
6. Rodar verificacao demo read-only.
7. Rodar verificacao live read-only.
8. Executar testes live por blocos, uma vez.
9. Registrar evidencias.
10. Decidir aprovacao final.

## Riscos

- Banco, RLS real e locks reais ainda nao foram testados nesta etapa.
- A homologacao futura depende de projeto demo novo e isolado.
- Os testes live exigem credenciais reais fora do Git e autorizacao manual explicita.
- A spec Playwright live depende de seletores reais do painel quando o deploy demo existir.

## Decisao

PRONTO PARA HOMOLOGACAO LIVE

Esta decisao significa que o pacote de preparacao esta pronto para a proxima etapa manual/autorizada. Nao significa que banco, Supabase, RLS real ou deploy foram testados.

