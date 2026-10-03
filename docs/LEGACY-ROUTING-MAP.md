# ELO NEXT — legacy routing map

This map is the migration inventory for the central-orchestrator primary rollout. A legacy entry remains in the codebase until its adapter has a passing gate; it is not treated as an independent final responder after promotion.

| NAME | FILE | TRIGGER | CURRENT PRIORITY | TARGET |
| --- | --- | --- | --- | --- |
| Core intent classifier | `relatorio-qualidade-obras/elo-assistente.js` | date, math, memory, POC/meta intents | early inside `askElo`/`buildResponseCore_` | KEEP AS TOOL / deterministic fast path |
| Command bridge | `relatorio-qualidade-obras/elo-command-bridge.js`, `elo-assistente.js` | explicit RDO/report/stock/municipal commands | before online fallback | KEEP AS TOOL |
| Local math/date fast path | `elo-assistente.js` | unambiguous arithmetic/date/time | before online request | KEEP AS DETERMINISTIC FAST PATH |
| Offline router | `elo-offline-router.js`, `elo-offline-core-v2.js` | browser offline or offline-capable command | before remote chat | MOVE UNDER ORCHESTRATOR as capability provider |
| Music/media router | `elo-media-player.js`, `elo-music-resolver.js`, `elo-assistente.js` | explicit player/media command | before general chat | KEEP AS EXPLICIT PLAYER TOOL |
| Active document payload | `elo-assistente.js` | PDF/file follow-up and pronouns | before remote chat payload | MOVE UNDER ORCHESTRATOR |
| Local document/library search | `elo-assistente.js` | document/library terms | inside response core | MOVE UNDER ORCHESTRATOR |
| Explicit memory | `elo-assistente.js` | `memorize`, `guarde`, `lembre` | very early in `askElo` | MOVE UNDER ORCHESTRATOR as `memory_store` |
| Memory recall | `elo-assistente.js` | recall/continue/name/project questions | response-core and persistence paths | MOVE UNDER ORCHESTRATOR as `memory_search` |
| Technical semantic route | `elo-assistente.js` | pathology/engineering terms | after local safety paths | KEEP AS ENGINEERING TOOL ADAPTER |
| Brain router | `elo-brain-router.js` | technical vs conversational scores | legacy service layer | KEEP AS ENGINE ADAPTER; remove competing authority after gate |
| Conversation conductor | `elo-conversation-conductor.js` | mode/stage/tone/next action | response post-processing | KEEP AS RESPONSE POLICY TOOL |
| Budget/residential engines | `elo-budget-*`, `elo-residential-*`, `elo-assistente.js` | budget/quantity/residential requests | deep response core | KEEP AS STRUCTURED ENGINEERING TOOLS |
| Technical service router | `elo-technical-service-router.js` | construction services and compositions | `askElo` before response core | MOVE UNDER ORCHESTRATOR |
| Report-from-context | `elo-assistente.js` | report/pdf from prior analysis | command bridge/response core | MOVE UNDER ORCHESTRATOR as report tool |
| RDO preview | `elo-assistente.js`, `elo-command-bridge.js` | RDO/photo/preview/create/confirm | early command path | KEEP AS RDO TOOL |
| Execution stock bridge | `elo-execution-stock-*.js`, `elo-assistente.js` | stock/alerts/materials/entry/exit | before generic response | KEEP AS TOOL; implementation out of scope |
| Stock Full bridge | `stock-full-*`, `elo-assistente.js` | explicit Stock Full product actions | command bridge | KEEP AS CONTRACT/API TOOL; do not edit Stock implementation |
| Autopilot | `elo-assistente.js` | prepare/publish/cancel editorial | before general fallback | KEEP AS AUTHORIZED ACTION TOOL |
| Visual/media ingestion | `elo-assistente.js` | image/photo/media analysis | before response core | MOVE UNDER ORCHESTRATOR |
| Universal online fallback | `elo-assistente.js` | no local/technical route | last resort | KEEP AS CENTRAL GENERAL-ASSISTANT TOOL |

## Migration rule

The central planner is now primary for the first cluster: deterministic fast paths, explicit memory, active-document follow-up, engineering adapter and explicit tool requests. The old functions remain callable through adapters. They may be removed or demoted only after the relevant corpus reaches its promotion threshold and the fallback reason is recorded.
