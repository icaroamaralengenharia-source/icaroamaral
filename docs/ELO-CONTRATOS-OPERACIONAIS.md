# ELO - Contratos Operacionais Unificados

Fase 4 cria contratos centrais somente em codigo, sem alterar banco, rotas, frontend ou fluxos operacionais existentes.

## Objetivo

Padronizar referencias operacionais entre ELO, Stock Obras, Stock Full, Sentinela, Timeline, Acervo, RDO e orcamentos para reduzir divergencias de nomenclatura e escopo antes de qualquer integracao real.

## Arquivo Central

`backend/src/contracts/elo-operational-contracts.js`

Exports principais:

- `normalizeMaterialNeed` / `validateMaterialNeed`
- `normalizeMaterialRequest` / `validateMaterialRequest`
- `normalizeStockMovementReference` / `validateStockMovementReference`
- `normalizeOperationalAlert` / `validateOperationalAlert`
- `normalizeAuditEvent` / `validateAuditEvent`
- adaptadores puros para ELO, Stock Obras, Stock Full, Sentinela, Timeline e RDO

## Contratos

Todos os contratos formais incluem `contract_version`, `institution_id`, `company_id`, `project_id`, `source_module`, `source_entity_type` e `source_entity_id`.

Os contratos guardam referencias e estados normalizados. Eles nao criam registros operacionais, nao recalculam saldos, nao aprovam solicitacoes, nao disparam alertas e nao enviam eventos para Timeline.

## Escopo e Seguranca

Validadores exigem isolamento por instituicao, empresa e obra. Metadados passam por sanitizacao para remover secrets, tokens, chaves, caminhos internos, HTML bruto, base64 e dados documentais sensiveis.

Unidades preservam o valor original e adicionam uma unidade canonica. Quantidades nao sao convertidas automaticamente.

## Adaptadores

Adaptadores fazem apenas leitura de objetos recebidos em memoria e retornam contratos ou referencias normalizadas. Eles nao chamam banco, rede, filesystem, APIs, filas ou servicos de modulo.

## Limites Desta Fase

Fase 4 nao altera:

- `/api/elo/chat`
- `elo.html` ou `elo.css`
- schemas, tabelas, RLS ou migracoes
- logica proprietaria de RDO, relatorios, orcamentos, Sentinela, Timeline, Acervo, Stock Obras ou Stock Full
- fluxos de estoque, saldo, sync offline ou movimentacao

## Testes

Suite especifica:

`node --test backend/tests/elo-operational-contracts.test.js`

As suites de Timeline, Sentinela, Acervo, Stock Obras, RDO, relatorios, documentos e orcamentos devem continuar sendo executadas como verificacao de regressao focada.
