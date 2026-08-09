# BUGS

## Bugs ativos novos

Nenhum bug funcional novo reproduzido nesta rodada.

## BUG-ANTIGO-001 - ELO UI timeout em /elo.html
- Modulo: ELO.
- Status antes: FALHA_FUNCIONAL, 7 timeouts em /elo.html.
- Status depois: RESOLVIDO.
- Evidencia: tests/e2e/elo-mobile-regressions.spec.js, 7/7 PASS.
- Fix relacionado: carregamento Vite /elo.html, Pesquise, continuidade de orcamento e historico mobile.

## BUG-ANTIGO-002 - Fluxo completo Almoxarifado + ELO timeout
- Modulo: Stock Full / Almoxarifado / ELO.
- Status antes: FALHA_FUNCIONAL.
- Status depois: RESOLVIDO.
- Evidencia: tests/e2e/almoxarifado.spec.js, fluxo completo passou em 1,8 min.

## RESSALVA-SEG-001 - Dependencias npm com vulnerabilidades
- Modulo: seguranca/dependencias.
- Root: 4 vulnerabilidades, 1 moderada e 3 altas.
- Backend: 2 vulnerabilidades, 1 baixa e 1 alta.
- Acao: npm audit nao destrutivo; nenhum fix executado.
- Severidade: P2 ate auditoria especifica de dependencias.
