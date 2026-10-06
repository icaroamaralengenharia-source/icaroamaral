# CHECKPOINT_ELO_AUTH_REFRESH_FINAL_2026-10-05

Data: 2026-10-05
Branch: `fix/elo-auth-refresh-20261005`
Commit de implementação: `bcae2d4`
PR: #163 — https://github.com/icaroamaralengenharia-source/icaroamaral/pull/163
Merge em `main`: `5b9796b91e5b2cb424a12221667e3cde21638e6e`

## Escopo e segurança

- Implementação restrita ao ELO Auth; Stock Full não foi alterado.
- A PR #162 não foi reaberta nem modificada.
- Nenhum token, JWT, cookie, senha ou header de autorização foi registrado neste checkpoint.
- Nenhum app financeiro foi aberto e nenhum dado do dispositivo foi limpo.

## Implementação entregue

- `EloCanonicalSession` passou a ser a única fonte de sessão válida e renovação.
- Refresh Supabase via `/auth/v1/token?grant_type=refresh_token`, usando o refresh token persistido.
- Margem preventiva padrão de 90 segundos, configurável até 300 segundos.
- Single-flight para chamadas concorrentes; refresh rotacionado é persistido.
- Falha transitória preserva a sessão; falha 4xx exige login e remove somente a sessão ELO.
- Logout invalida a geração da sessão e impede que um refresh tardio reviva a sessão.
- Consumidores protegidos usam headers assíncronos e fazem no máximo um retry após 401.
- Cache-busters atualizados em `elo.html`, service worker e superfície de relatório.

## Validação local

- 54 testes ELO de auth, imagem, memória, relatório, identidade, startup, restart, concorrência e retry: PASS.
- 12 contratos canônicos de auth existentes: PASS.
- `node --check` em `elo-assistente.js`, `elo-command-bridge.js` e `elo-sw.js`: PASS.
- `git diff --check`: PASS.

## CI, merge e Web

- Checks da PR: Workers Builds PASS; checks de Pages/redirect/header concluídos sem falha.
- Deploy de Pages do merge: PASS (`pages build and deployment`, run 37398390621).
- HTML principal publicado com `20261005-elo-auth-refresh-v1`.
- Relatório publicado com `20261005-elo-auth-refresh-v1`.
- Hashes SHA-256 normalizados dos três JS publicados coincidem com o checkout local:
  - `elo-assistente.js`
  - `elo-command-bridge.js`
  - `elo-sw.js`

## Android oficial

- Dispositivo: `R9XW20CKEBK` via ADB na porta 15037.
- Pacote: `br.com.icaroamaral.elo`.
- `versionCode=6`, `versionName=0.4.2`, `targetSdk=35`.
- APK oficial é um WebView que consome o Web publicado; não houve mudança nativa e não houve reinstalação.
- Após force-stop/reopen pós-deploy: WebView carregou, mostrou `Online` e `Sessão ativa`; não houve `FATAL EXCEPTION`/`AndroidRuntime` no recorte verificado do logcat.
- O gate adicional `Acesso restrito` apareceu ao avançar para os controles. Nenhuma senha foi adivinhada ou submetida; por isso, a sequência física de ações autenticadas de imagem, memória, relatório e identidade ficou bloqueada nesse ponto.

Status: código, Web, CI, deploy e smoke oficial Android concluídos; validação física profunda de fluxos autenticados aguarda acesso explícito ao gate do site.
