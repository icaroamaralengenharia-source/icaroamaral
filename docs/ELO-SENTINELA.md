# ELO SENTINELA

## Objetivo

O ELO Sentinela e um modulo isolado para registrar evidencias e timeline tecnica por obra. A Fase 1 cria apenas a fundacao: feature flag, schema proprio, store, service, router e testes de isolamento.

Esta fase nao gera RDO, relatorio, alerta, pendencia, memoria do ELO ou analise de IA.

## Arquitetura isolada

- Rotas novas sob `/api/elo/sentinel/*`.
- Tabelas novas com prefixo `elo_sentinel_`.
- Store isolado em `backend/src/elo-sentinel-store.js`.
- Service isolado em `backend/src/elo-sentinel-service.js`.
- Router isolado em `backend/src/elo-sentinel-router.js`.
- Registro minimo no `backend/src/app.js`.

O ELO conversa em `/api/elo/chat`, ObraReport, RDO, Stock Obras, Stock Full, orcamento e memoria continuam fora do fluxo Sentinela nesta fase.

## Feature flag

Variavel por nome:

- `ELO_SENTINEL_ENABLED`

Quando a variavel nao esta definida ou nao esta ligada explicitamente, as rotas Sentinela respondem `elo_sentinel_disabled` sem afetar o restante do backend.

## Tabelas

Schema principal:

- `backend/src/data/elo-sentinel-schema.sql`

Tabelas criadas:

- `elo_sentinel_evidences`
- `elo_sentinel_events`

Campos de isolamento obrigatorio:

- `institution_id`
- `company_id`
- `project_id`

A aplicacao nunca deve listar ou criar registros Sentinela sem os tres campos.

## Rotas da Fase 1

- `POST /api/elo/sentinel/evidences`
- `GET /api/elo/sentinel/evidences`
- `GET /api/elo/sentinel/timeline`

Comportamento:

- feature flag desligada: `503 elo_sentinel_disabled`;
- sem autenticacao: `401 authentication_required`;
- sem `institution_id`, `company_id` ou `project_id`: erro seguro;
- listagens filtradas obrigatoriamente por obra ativa.

## Isolamento

O modulo usa o contexto real do backend por `resolveAuthContext`. O escopo pode vir do contexto autenticado e da requisicao, mas a operacao so segue quando `institution_id`, `company_id` e `project_id` estao completos.

## Limitacoes da Fase 1

- Nao ha frontend.
- Nao ha upload binario persistente.
- Nao ha IA.
- Nao ha pendencias.
- Nao ha RDO ou relatorio gerado a partir do Sentinela.
- Nao ha uso em producao antes da suite completa.

## Rollback

Rollback seguro:

1. Desligar `ELO_SENTINEL_ENABLED`.
2. Remover o registro das rotas Sentinela em novo commit, se necessario.
3. Remover apenas tabelas `elo_sentinel_*` em ambiente controlado, se houver plano aprovado.

Como a Fase 1 usa rotas e tabelas novas, o rollback nao exige alterar tabelas existentes.

## Proximos estagios

1. Evidencias com armazenamento de arquivo.
2. Pendencias com responsavel, prazo, prioridade e status.
3. Validacao humana obrigatoria.
4. Integracao controlada ao ELO.
5. RDO e relatorio apenas com fatos validados.
6. E2E real completo antes de producao.

## Proibicao

Nao usar em producao antes de testes completos e revisao de seguranca. Nao registrar secrets, tokens, senhas, cookies ou chaves Supabase nesta documentacao.
