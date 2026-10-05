# Stock Full — checkpoint final e handoff comercial

Data: 2026-10-05  
Escopo: Stock Full standalone

## Estado de release

- Certificação: **STRESS CERTIFIED**
- Pronto para venda: **YES**
- PR #160: **MERGED / DEPLOYED**
- Matriz: **24/24 PASS** — 23 verificações `SF` e uma linha de gate final, todas aprovadas.
- Reconciliação: **40/40**, diferença total 0.
- Lost updates: **0**; crashes: **0**; P0 aberto: **0**.
- Tenant A/B, Direct-ID, UI/Cloud, Offline, Work Scope, Mobile, Security e Health: **PASS**.

## Evidências finais

- SHA256 do certificado de stress: `e2b0c3d60304e448d03ab1bd3bc51e1854772476b4f6563c172c1358b4c095e7`
- SHA256 do ZIP do pacote cliente: `9c7a3edf79eaa02d1aca61c1e0e3eed8b3d9040511fb7c0ab78408b806f1311e`
- Pacote cliente local: `C:\elo-release-proof\stock-full-client-package-final-2026-10-05\08-PACOTE-CLIENTE\STOCK_FULL_Standalone_Client_Package_2026-10-05.zip`
- Certificado local: `C:\elo-release-proof\stock-full-client-package-final-2026-10-05\03-CERTIFICADO\CERTIFICADO_STRESS_TEST_STOCK_FULL_2026-10-05.pdf`
- A matriz CSV/XLSX e os demais PDFs estão no mesmo diretório do pacote, sob `05-MATRIZ`, `01-RELATORIO-EXECUTIVO`, `02-ANEXO-TECNICO` e `04-RESUMO-COMERCIAL`.

## Regressão permanente

O workflow `.github/workflows/backend-security-gate.yml` executa `node --test tests/stock-full-*.test.js` em PRs e pushes que alteram `backend/**`. O novo teste Tenant A/B/Direct-ID está em `backend/tests/stock-full-product-permissions.test.js`; a proteção de Direct-ID na API e no RPC também é verificada por `backend/tests/stock-full-atomic-movement.test.js`. Não há dependência de credenciais live nesses testes.

## Regra de manutenção do fechamento

Não reabrir a certificação Stock Full nem repetir stress, writes live ou etapas já aprovadas sem uma regressão objetiva reproduzível. Em caso de regressão, registrar evidência, causa-raiz e escopo mínimo; então executar somente o teste direcionado e os gates necessários. A migration/RPC não deve ser reaplicada ou alterada sem evidência nova.

Os relatórios `STRESS_INCOMPLETE` permanecem como histórico; não foram sobrescritos nem removidos.

## Handoff comercial

Oferta: Stock Full standalone, com estoque geral e por obra, movimentos de entrada/saída, histórico, operação offline sincronizada e interfaces desktop/mobile. Apresentar o relatório executivo e o resumo comercial; manter o anexo técnico, certificado, matriz e ZIP como evidência de apoio. Os arquivos contêm somente dados sintéticos de teste, sem credenciais ou tokens.

Próxima frente de engenharia: **RDO — CERTIFICAÇÃO COMERCIAL STANDALONE**. Esta transição não reabre os gates de Stock Full.
