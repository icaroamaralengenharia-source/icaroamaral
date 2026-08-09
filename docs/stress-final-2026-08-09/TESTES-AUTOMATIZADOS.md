# TESTES AUTOMATIZADOS

## Checks sintaticos

- node --check relatorio-qualidade-obras/elo-assistente.js: PASS.
- node --check backend/src/app.js: PASS.
- node --check noticias/noticias.js: PASS.

## Node

Comando principal: node --test em suites representativas limpas de ELO, PDF guards, Stock Full, Stock Obras, ObraReport/RDO, Patrimonio/Municipal, Sentinela e seguranca.

Resultado: 430 PASS / 0 FAIL / 0 SKIP.

ELO formal: node --test backend/tests/elo-intent-router.test.js backend/tests/report-image-bridge.test.js.
Resultado: 29 PASS / 0 FAIL. Incluido no total Node acima.

Nota: a tentativa inicial de node --test backend/tests/*.test.js sem dependencias instaladas nao foi usada como resultado comparavel; depois as dependencias locais foram instaladas e a selecao representativa limpa foi executada.

## Playwright

Comandos:
- npx playwright test tests/e2e/elo-mobile-regressions.spec.js.
- npx playwright test tests/e2e/almoxarifado.spec.js.
- npx playwright test tests/e2e/stock-full-saas.spec.js tests/e2e/municipal-admin-ui.spec.js tests/e2e/municipal-asset-offline.spec.js tests/e2e/elo-sentinel-ui.spec.js.

Resultado agregado: 105 PASS / 0 FAIL / 1 SKIP.

Falhas antigas revalidadas:
- 7 timeouts ELO UI: agora 7/7 PASS.
- 1 timeout fluxo Almoxarifado/ELO: agora PASS.

## Total automatizado contado

535 PASS / 0 FAIL / 1 SKIP.

## Vulnerabilidades

- Root: 4 vulnerabilidades, 1 moderada e 3 altas.
- Backend: 2 vulnerabilidades, 1 baixa e 1 alta.
- Nenhum npm audit fix foi executado.
