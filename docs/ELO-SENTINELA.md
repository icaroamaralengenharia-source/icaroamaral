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

### E2E remoto validado

O schema acumulado das Fases 1, 2 e 3 foi validado no Supabase E2E TEST isolado, sem uso de producao. O spec real fica em `tests/e2e/real/elo-sentinel-real.spec.js`.

Fluxo validado:

1. autenticacao no tenant E2E;
2. criacao de evidencia textual;
3. persistencia da evidencia;
4. evento `evidence_created` na timeline;
5. idempotencia por `idempotency_key` sem duplicata;
6. criacao de pendencia vinculada a evidencia source;
7. transicoes `open` e `in_progress`;
8. evidencia de correcao;
9. vinculo `correction`;
10. transicao para `awaiting_validation`;
11. validacao humana `approved`;
12. status final `resolved` e `validation_status` `approved`;
13. preenchimento de `validated_by` e `validated_at`;
14. timeline final com eventos da jornada;
15. isolamento entre obra A e obra B;
16. isolamento entre tenant A e tenant B;
17. smoke de `/api/elo/chat`;
18. smoke de ObraReport.

Comandos executados na validacao:

- `node --test backend\tests\elo-sentinel-foundation.test.js backend\tests\elo-sentinel-evidence-timeline.test.js backend\tests\elo-sentinel-pending-validation.test.js`
- `npx.cmd playwright test tests/e2e/real/elo-sentinel-real.spec.js --reporter=line`

A validacao real encontrou e corrigiu um vazamento de campos de pendencia para `elo_sentinel_events` no evento `pending_item_created`. O evento agora recebe apenas colunas validas na raiz e dados de pendencia ficam em `metadata`.

Nao usar producao.

## Fase 4: integracao visual segura

A Fase 4 adiciona uma interface visual minima do ELO Sentinela dentro do proprio ELO, sem criar segundo chat e sem alterar o comportamento padrao do modo Conversa.

### Feature flag visual

A interface visual usa a flag frontend `ELO_SENTINEL_UI_ENABLED`, desligada por padrao. Quando a flag nao esta ativa, o seletor Sentinela, o painel visual e chamadas para `/api/elo/sentinel/*` permanecem ocultos.

O painel tambem exige backend Sentinela disponivel, usuario autenticado, empresa ativa e obra ativa valida. Sem obra ativa, a UI nao mostra formularios nem dispara fetch Sentinela e exibe apenas: `Selecione uma obra para usar o Sentinela.`

### Modo dentro do ELO

O ELO passa a ter um controle discreto de modo:

- `Conversa`
- `Sentinela`

O modo padrao continua sendo `Conversa`. A alternancia para Sentinela nao altera historico do chat, prompt, memoria, roteamento ou `/api/elo/chat`.

### Blocos visuais

O modulo visual isolado fica em `relatorio-qualidade-obras/elo-sentinel-ui.js`, com estilos em `relatorio-qualidade-obras/elo-sentinel-ui.css`.

Blocos criados:

- contexto da empresa e obra ativa;
- registro de evidencia textual/manual;
- evidencias recentes;
- timeline;
- pendencias;
- abertura manual de pendencia;
- transicoes seguras de status;
- vinculo de evidencia de correcao;
- validacao humana.

A UI nao permite resolver pendencia diretamente, nao aceita `company_id` ou `institution_id` por input manual e nao permite `validated_by` pelo frontend. A validacao aprovada ou rejeitada usa a rota dedicada e deixa claro que a IA nao conclui tecnicamente: a validacao e humana.

### Resultados da validacao

- UI Sentinela: `6/6 PASS` em `tests/e2e/elo-sentinel-ui.spec.js`.
- E2E real Sentinela: `2/2 PASS` em `tests/e2e/real/elo-sentinel-real.spec.js`.
- Backend relevante: `67/67 PASS`.
- `node --check relatorio-qualidade-obras/elo-sentinel-ui.js`: PASS.
- `git diff --check`: PASS.
- Varredura de secrets nos arquivos alterados: sem ocorrencias.

### Falhas frontend preexistentes

As falhas abaixo foram comparadas no worktree da Fase 4 e em copia limpa do HEAD `a08001e`, com resultado igual. Permanecem fora do escopo desta fase:

- `tests/e2e/elo-surfaces.spec.js`: falha preexistente; esperava `brain = "technical"` e recebeu `""`.
- `tests/e2e/elo-conversation-conductor.spec.js`: falha preexistente; respostas genericas no lugar dos textos esperados.
- `tests/e2e/elo-mobile-regressions.spec.js`: instabilidade preexistente; timeout com `--workers=1` no worktree e no HEAD limpo.

### Limitacoes atuais

- Sem upload binario, foto, audio ou video.
- Sem IA para concluir tecnicamente eventos.
- Sem geracao automatica de RDO, relatorio ou PDF.
- Sem uso em producao antes de revisao operacional.
- A flag visual deve permanecer desligada por padrao.

### Proximos passos

1. Corrigir em etapa separada as falhas frontend preexistentes do ELO.
2. Evoluir upload controlado de evidencias.
3. Adicionar filtros e paginacao mais completos no painel visual.
4. Planejar integracoes com RDO e relatorios somente com fatos validados.
## Timeline operacional unica da obra

A Timeline Operacional Unica transforma `elo_sentinel_events` no indice cronologico central da obra. Ela nao substitui RDO, relatorios tecnicos, documentos, orcamentos ou PDFs: cada modulo segue como fonte da verdade e a timeline guarda apenas referencias seguras.

### Feature flag

A rota operacional usa flag propria e fica desligada por padrao:

- `ELO_OPERATIONAL_TIMELINE_ENABLED`

Alias aceito:

- `ELO_SENTINEL_OPERATIONAL_TIMELINE_ENABLED`

Com a flag desligada, `GET /api/elo/projects/:projectId/timeline` responde `elo_operational_timeline_disabled` e nao afeta `/api/elo/chat` nem as rotas atuais do Sentinela.

### Evolucao aditiva de `elo_sentinel_events`

Campos adicionados quando ausentes:

- `source_module`
- `source_entity_type`
- `source_entity_id`
- `severity`
- `status`
- `idempotency_key`

Indices adicionados:

- escopo e ordenacao por `institution_id`, `company_id`, `project_id`, `occurred_at`, `created_at`;
- origem por `source_module`, `source_entity_type`, `source_entity_id`;
- filtros por `severity` e `status`;
- indice unico contextual para `idempotency_key` nao nula.

O constraint de `event_type` passa a aceitar qualquer texto nao vazio para permitir extensao futura sem invalidar eventos antigos.

### Contrato `OperationalTimelineEvent`

Campos normalizados:

- `id`
- `institution_id`
- `company_id`
- `project_id`
- `event_type`
- `source_module`
- `source_entity_type`
- `source_entity_id`
- `title`
- `description`
- `occurred_at`
- `created_by`
- `severity`
- `status`
- `metadata`
- `idempotency_key`

Fontes iniciais:

- `sentinel`
- `obrareport`
- `rdo`
- `technical_report`
- `generated_document`
- `elo_budget`
- `budget_pdf`

Severidades iniciais:

- `informational`
- `minor`
- `major`
- `critical`

Status operacionais iniciais:

- `created`
- `active`
- `completed`
- `cancelled`
- `failed`
- `archived`

### Rota

`GET /api/elo/projects/:projectId/timeline`

Filtros:

- `date_from`
- `date_to`
- `event_type`
- `source_module`
- `source_entity_type`
- `source_entity_id`
- `severity`
- `status`
- `created_by`
- `search`
- `limit`
- `offset` ou `cursor`

A rota exige autenticacao, escopo completo por `institution_id`, `company_id` e `project_id`, e nao confia em body/query para tenant. O filtro `created_by` so e aplicado quando enviado explicitamente na query.

### Adaptadores iniciais

Adaptadores isolados registram referencias apos sucesso da operacao original:

- Sentinela: evidencia, pendencia, validacao e correcao;
- RDO: criado, atualizado e documento gerado;
- relatorios tecnicos: criado, atualizado e documento gerado;
- documentos gerados do ObraReport;
- orcamento: criado, versao criada e PDF gerado.

Se a timeline falhar, a operacao original nao e desfeita. A falha e registrada de forma segura no log do backend.

### Idempotencia

Chave preferencial:

`source_module:source_entity_type:source_entity_id:event_type:version`

A mesma chave no mesmo tenant, empresa e obra retorna o evento existente. A mesma chave em outra obra ou tenant nao colide. Eventos sem `idempotency_key` continuam validos para compatibilidade.

### Referencia sem copia

A timeline nunca copia PDF, HTML, arquivo, documento completo ou payload proprietario. `metadata` e sanitizada para remover conteudo bruto, chaves de documento, PDF, HTML, base64 e campos equivalentes. A busca textual consulta apenas titulo, descricao, metadata segura, modulo e tipo de origem.

### Eventos orfaos

Quando a origem referenciada nao existe mais, o evento permanece na timeline com `source_exists: false`. A listagem nao retorna erro 500, nao remove historico e nao inventa URL.

### Validacao

Resultados desta fase:

- Timeline operacional: `3/3 PASS` em `backend/tests/elo-operational-timeline.test.js`.
- Sentinela Fases 1, 2 e 3 + adaptadores ObraReport/orcamento: `38/38 PASS`.
- E2E real Timeline: `1/1 PASS` em `tests/e2e/real/elo-operational-timeline-real.spec.js`.
- E2E real Sentinela: `2/2 PASS` em `tests/e2e/real/elo-sentinel-real.spec.js`.
- UI Sentinela: `6/6 PASS` em `tests/e2e/elo-sentinel-ui.spec.js`.

A validacao E2E real usou somente Supabase E2E TEST, com schema confirmado antes da execucao e sem aplicar migracao remota nesta etapa.

### Limitacoes

- Stock Obras, Stock Full e Stock Saude ficam fora desta fase.
- Nenhuma conclusao tecnica automatica e gerada.
- A timeline e indice operacional, nao acervo documental.
- Acervo e anexos controlados ficam para etapa posterior.
