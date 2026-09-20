# Checkpoint — ELO Conversational Behavior

Data: 2026-09-20

## Escopo

- Projeto: ELO Oficial.
- Branch: `feat/elo-conversational-behavior`.
- Base: `origin/main` (`a073b41ff9b180ff0b9765ec09fe113302b2b224`).
- ELO Mensageiro: não tocado.
- Android: nenhum arquivo alterado; o cliente online carrega o mesmo `elo.html` pelo WebView.

## Arquitetura antes

- O backend já montava um prompt mestre com histórico, memória, contexto de projeto e continuidade técnica.
- O frontend possuía `elo-communication-policy.js`, mas ele atuava principalmente como pós-processador de resposta.
- O comportamento conversacional estava dividido entre prompt backend, heurísticas frontend e `elo-conversation-conductor.js`.

## Arquitetura depois

- `elo-communication-policy.js` agora é a política canônica compartilhada, com regras de naturalidade, contexto, conselho, incerteza, segurança e formatos estruturados.
- O backend carrega a mesma política canônica ao montar `ELO_CONVERSATIONAL_POLICY` no system prompt.
- Web, `relatorio-qualidade-obras` e `stock-ai-obras` carregam a política antes do conductor/assistente.
- O service worker inclui a política no shell offline.
- Rotas de ação, relatório, JSON e fallback offline continuam preservadas e não recebem prosa fora do formato.

## Arquivos alterados

- `backend/src/app.js`
- `backend/tests/elo-conversational-behavior.test.js`
- `elo.html`
- `stock-ai-obras.html`
- `relatorio-qualidade-obras/relatorio-qualidade-obras.html`
- `relatorio-qualidade-obras/elo-communication-policy.js`
- `elo-sw.js`
- `CHECKPOINT_ELO_CONVERSATIONAL_20260920.md`

## Validações

- `node --check`: PASS.
- Testes novos de comportamento: 6 PASS / 0 FAIL.
- Cobertura determinística: cálculo simples, decisão, continuidade, contexto, conselho, discordância, risco, incerteza, primeira pessoa, conversa casual, relatório/JSON/ação e memória.
- `git diff --check`: PASS.
- `npm run build`: PASS.
- Android online/WebView: usa o mesmo artefato Web; nenhuma reinstalação necessária nesta etapa.

## Regressões da base

As suítes amplas da base `origin/main` foram executadas. Há falhas preexistentes fora do diff desta frente, incluindo divergências de roteamento, cache-buster esperado por testes antigos e arquivos com codificação incompatível com as asserções existentes. Nenhuma dessas falhas foi enfraquecida ou alterada nesta frente.

## Estado de integração

- Commit: `90d14a2`.
- Push: concluído em `feat/elo-conversational-behavior`.
- PR: [#85](https://github.com/icaroamaralengenharia-source/icaroamaral/pull/85), aberto.
- Merge: não realizado; gate bloqueado pelas falhas preexistentes da base.
- Deploy: não realizado.
- Dados apagados: não.
- ELO Mensageiro tocado: não.

## Pendências objetivas

1. Aguardar os checks remotos do PR #85 e manter o merge bloqueado enquanto houver falhas.
2. Corrigir ou reancorar as falhas preexistentes da suíte principal antes de integração.
3. Após checks verdes, executar conjunto idêntico de prompts no Web e no Device A.
4. Só então avaliar merge e publicação.
