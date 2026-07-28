# ELO SENTINELA

## Objetivo

O ELO Sentinela e um modulo isolado para registrar evidencias e timeline tecnica por obra. A Fase 2 entrega evidencia persistente textual/metadados, referencia opcional de arquivo, hash quando aplicavel, idempotencia e consulta paginada por obra.

Esta fase nao gera RDO, relatorio, alerta, pendencia, memoria do ELO, upload binario, audio, video ou analise de IA.

## Arquitetura isolada

- Rotas novas sob `/api/elo/sentinel/*`.
- Tabelas novas com prefixo `elo_sentinel_`.
- Store isolado em `backend/src/elo-sentinel-store.js`.
- Service isolado em `backend/src/elo-sentinel-service.js`.
- Router isolado em `backend/src/elo-sentinel-router.js`.

O ELO conversa em `/api/elo/chat`, ObraReport, RDO, Stock Obras, Stock Full, orcamento e memoria continuam fora do fluxo Sentinela nesta fase.

## Feature flag

Variavel por nome:

- `ELO_SENTINEL_ENABLED`

Quando a variavel nao esta definida ou nao esta ligada explicitamente, as rotas Sentinela respondem `elo_sentinel_disabled` sem afetar o restante do backend.

## Tabelas

Schema principal:

- `backend/src/data/elo-sentinel-schema.sql`

Tabelas:

- `elo_sentinel_evidences`
- `elo_sentinel_events`

Campos de isolamento obrigatorio:

- `institution_id`
- `company_id`
- `project_id`

Campos principais de evidencia:

- `evidence_type`
- `source`
- `title`
- `description`
- `storage_path`
- `file_hash`
- `mime_type`
- `metadata`
- `status`
- `occurred_at`
- `idempotency_key`

A aplicacao nunca deve listar ou criar registros Sentinela sem `institution_id`, `company_id` e `project_id` completos.

## Rotas da Fase 2

### POST /api/elo/sentinel/evidences

Cria evidencia e evento automatico de timeline.

Campos aceitos:

- `project_id` ou `projectId`
- `evidence_type` ou `evidenceType`
- `source`
- `title`
- `description`
- `storage_path` ou `storagePath`
- `file_hash` ou `fileHash`
- `mime_type` ou `mimeType`
- `metadata`
- `occurred_at` ou `occurredAt`
- `content`
- `idempotency_key`, `idempotencyKey`, `operation_id` ou `operationId`

Tipos permitidos:

- `text`
- `photo`
- `document`
- `note`

Regras:

- `institution_id`, `company_id` e `created_by` vem do contexto autenticado.
- `project_id` e obrigatorio.
- `evidence_type` e obrigatorio.
- `title` e obrigatorio.
- Deve haver `description`, `storage_path` ou hash/conteudo.
- `storage_path` nao pode ser URL publica, caminho absoluto, drive local ou conter `..`.
- `status` inicial e controlado pelo backend como `registered`.
- Campo desconhecido e rejeitado.

### GET /api/elo/sentinel/evidences

Lista evidencias por obra.

Filtros:

- `project_id` ou `projectId`
- `evidence_type`
- `source`
- `date_from`
- `date_to`
- `limit`
- `offset` ou `cursor`

Retorno inclui `evidences` e `page` com `limit`, `offset`, `next_offset` e `has_more`.

### GET /api/elo/sentinel/timeline

Lista eventos por obra.

Filtros:

- `project_id` ou `projectId`
- `event_type`
- `date_from`
- `date_to`
- `limit`
- `offset` ou `cursor`

Eventos de evidencia usam `event_type: evidence_created` e incluem resumo seguro da evidencia relacionada quando disponivel.

## Hash e integridade

- Se `file_hash` vier preenchido, o backend valida SHA-256 hexadecimal de 64 caracteres.
- Se houver `content` e nenhum hash, o backend calcula SHA-256 deterministico do texto recebido.
- O backend nao baixa arquivos, nao acessa URL publica e nao inventa hash de arquivo nao recebido.
- `metadata.hash_source` registra `provided` ou `content_sha256` quando aplicavel.

## Idempotencia

A idempotencia usa `idempotency_key` contextual por `institution_id`, `company_id` e `project_id`.

Regras:

- mesma chave na mesma obra retorna o registro original;
- mesma chave em outra obra ou tenant nao colide;
- o retorno idempotente usa HTTP 200;
- a primeira criacao usa HTTP 201.

## Timeline

Ao criar evidencia com sucesso, o service cria automaticamente um evento:

- `event_type: evidence_created`
- `evidence_id`
- `title`
- `description`
- `occurred_at`
- `created_by`
- `metadata.evidence_type`
- `metadata.source`

## Estrategia transacional

O store Supabase cria evidencia e evento em sequencia usando o cliente atual do projeto. Como nao ha helper transacional dedicado neste modulo, a estrategia da Fase 2 e compensatoria: se a criacao do evento falhar apos a evidencia, o store tenta apagar a evidencia recem-criada dentro do mesmo escopo antes de retornar erro seguro.

O store em memoria usado nos testes aplica a mesma regra.

## Isolamento

O modulo usa `resolveAuthContext` do backend. `institution_id`, `company_id` e `created_by` nao sao confiados ao body da requisicao. Consultas e escritas sempre exigem escopo completo.

## Limitacoes da Fase 2

- Nao ha frontend.
- Nao ha upload binario persistente.
- Nao ha IA.
- Nao ha pendencias.
- Nao ha validacao humana.
- Nao ha RDO ou relatorio gerado a partir do Sentinela.
- Nao ha uso em producao antes da suite completa.

## Rollback

Rollback seguro:

1. Desligar `ELO_SENTINEL_ENABLED`.
2. Remover o registro das rotas Sentinela em novo commit, se necessario.
3. Remover apenas tabelas `elo_sentinel_*` em ambiente controlado, se houver plano aprovado.

Como a Fase 2 usa rotas e tabelas isoladas, o rollback nao exige alterar tabelas existentes de ELO, ObraReport, RDO, Stock Obras, Stock Full, orcamento ou memoria.

## Proximos estagios

1. Upload binario controlado em storage seguro.
2. Pendencias com responsavel, prazo, prioridade e status.
3. Validacao humana obrigatoria.
4. Integracao controlada ao ELO.
5. RDO e relatorio apenas com fatos validados.
6. E2E real completo antes de producao.

## Proibicao

Nao usar em producao antes de testes completos e revisao de seguranca. Nao registrar secrets, tokens, senhas, cookies ou chaves Supabase nesta documentacao.
## Fase 3: pendencias tecnicas e validacao humana

A Fase 3 adiciona pendencias tecnicas isoladas ao ELO Sentinela, mantendo frontend, ELO Conversa, ObraReport, RDO, Stock Obras, Stock Full, orcamento e memoria fora do fluxo.

### Tabelas da Fase 3

- `elo_sentinel_pending_items`
- `elo_sentinel_pending_item_evidences`

Campos principais de `elo_sentinel_pending_items`:

- `source_evidence_id`
- `title`
- `description`
- `category`
- `priority`
- `severity`
- `status`
- `responsible_user_id`
- `due_at`
- `suggested_by`
- `created_by`
- `validated_by`
- `validated_at`
- `validation_status`
- `resolution_notes`
- `resolved_at`
- `metadata`
- `idempotency_key`

### Rotas da Fase 3

- `POST /api/elo/sentinel/pending-items`
- `GET /api/elo/sentinel/pending-items`
- `GET /api/elo/sentinel/pending-items/:id`
- `PUT /api/elo/sentinel/pending-items/:id`
- `POST /api/elo/sentinel/pending-items/:id/evidences`
- `POST /api/elo/sentinel/pending-items/:id/validate`

Todas exigem feature flag ligada, autenticacao e `project_id`.

### Estados

Status permitidos:

- `suggested`
- `open`
- `in_progress`
- `awaiting_validation`
- `resolved`
- `rejected`
- `cancelled`

Validation status:

- `pending`
- `approved`
- `rejected`

Priority:

- `low`
- `medium`
- `high`
- `critical`

Severity:

- `informational`
- `minor`
- `major`
- `critical`

### Transicoes

- `suggested` -> `open`, `rejected`, `cancelled`
- `open` -> `in_progress`, `awaiting_validation`, `cancelled`
- `in_progress` -> `awaiting_validation`, `open`, `cancelled`
- `awaiting_validation` -> `in_progress`, `resolved`, `rejected`

`resolved` exige validacao humana aprovada. `awaiting_validation` exige evidencia de correcao vinculada. `rejected` e `cancelled` exigem justificativa por `resolution_notes` ou `metadata.reason`.

### Vinculo de evidencias

`POST /pending-items/:id/evidences` vincula uma evidencia existente da mesma obra e tenant. Tipos permitidos:

- `source`
- `correction`
- `validation`
- `supporting`

O vinculo duplicado com mesma pendencia, evidencia e tipo retorna o vinculo existente e nao cria duplicata.

### Validacao humana

`POST /pending-items/:id/validate` aceita `decision: approved` ou `decision: rejected`.

Regras:

- `validated_by` sempre vem do usuario autenticado.
- `approved` exige pendencia em `awaiting_validation`.
- `approved` exige evidencia de correcao vinculada.
- `approved` altera `validation_status` para `approved` e `status` para `resolved`.
- `rejected` exige `notes`.
- `rejected` altera `validation_status` para `rejected` e retorna o status para execucao.

### Eventos automaticos

A Fase 3 registra eventos na timeline:

- `pending_item_created`
- `pending_item_updated`
- `pending_item_status_changed`
- `pending_item_assigned`
- `pending_item_due_date_changed`
- `pending_item_evidence_linked`
- `pending_item_validated`
- `pending_item_validation_rejected`

### Limitacoes da Fase 3

- Nao ha IA.
- Nao ha audio ou video.
- Nao ha geracao de RDO ou relatorio.
- Nao ha integracao visual.
- Nao ha aplicacao remota do schema nesta fase.

### E2E remoto pendente

O schema acumulado das Fases 1, 2 e 3 precisa ser aplicado ao Supabase E2E isolado antes de executar a suite real remota. Depois disso, validar o fluxo:

1. evidencia;
2. pendencia;
3. evidencia de correcao;
4. `awaiting_validation`;
5. validacao humana;
6. timeline.

Nao usar producao.
