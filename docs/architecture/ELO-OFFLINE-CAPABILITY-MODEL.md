# ELO — Offline Capability Model

## Objetivo

O ELO mantém uma única identidade e um único roteador de capacidades. Cada pedido é classificado antes de qualquer chamada remota:

1. capacidade local determinística;
2. dado local/cacheado escopado por usuário e tenant;
3. capacidade remota autenticada;
4. fallback honesto quando o recurso não existe localmente.

## Estados de conectividade

`relatorio-qualidade-obras/elo-offline-state.js` define os estados:

- `ONLINE`: rede, backend e sessão exigida estão disponíveis;
- `DEGRADED_BACKEND`: transporte aparente existe, mas o backend falha/expira;
- `AUTH_REQUIRED`: backend responde, mas a sessão precisa ser renovada;
- `REMOTE_CAPABILITY_UNAVAILABLE`: somente a capability remota falhou;
- `OFFLINE`: não há evidência suficiente de transporte;
- `LOCAL_ONLY`: modo local escolhido explicitamente.

HTTP 500, timeout e falha de backend não são apresentados como “offline”. HTTP 401/403 não são apresentados como falha de rede.

## Registry

`elo-offline-capability-registry.js` registra exatamente 200 casos em 20 categorias. A lista é a fonte usada pelo teste de contrato e pela resposta de capacidades locais; não existe uma segunda personalidade offline.

## Dados locais e segurança

`elo-offline-local-store.js` usa uma chave escopada por `userId|tenantId`. Sem os dois identificadores, o store não lê nem grava dados privados. RDO, Stock e Vistoria locais são snapshots/drafts; um draft recebe `LOCAL_DRAFT` e `PENDING_SYNC` e nunca é descrito como sincronizado.

O store não executa escrita remota, não altera saldo oficial e não tenta sincronizar automaticamente. A reconciliação e a política de conflito permanecem responsabilidade do fluxo online já existente.

## Cache e reconexão

O Service Worker usa o cache `elo-web-offline-v15-20260927-step14-real-v1`, mantém o shell e os assets locais, e deixa endpoints `/api/elo/` fora do cache. A troca de versão remove caches ELO antigos. Dados privados continuam sujeitos ao escopo de identidade; cache stale deve ser revalidado quando a sessão/backend voltarem.

## Voz

O roteamento local é aditivo ao wake/voice handoff do Step 13. O bridge nativo continua sendo o dono da deduplicação e da entrega; Step 14 não altera autenticação, TTS ou o pipeline de wake.

## Limitações explícitas

- análise remota, geração de PDF e escrita no backend não são fingidas offline;
- a disponibilidade de RDO/Stock/Vistoria depende de snapshot local autorizado;
- smoke físico Android e build Gradle precisam de ADB/loopback do host;
- produção não é declarada PASS neste Step.
