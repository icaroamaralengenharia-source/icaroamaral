# COMPARACAO ANTES DEPOIS

| METRICA | ANTES | DEPOIS | DELTA |
|---|---:|---:|---:|
| TOTAL | 270 | 270 | 0 |
| PASS | 241 | 249 | +8 |
| PASS_COM_RESSALVA | 15 | 15 | 0 |
| FALHA_FUNCIONAL | 8 | 0 | -8 |
| FALHA_INFRA | 0 | 0 | 0 |
| NAO_CONECTADO | 5 | 5 | 0 |
| INCONCLUSIVO | 1 | 1 | 0 |
| AUTOMATED PASS | 592 | 535 | -57* |
| AUTOMATED FAIL | 8 | 0 | -8 |
| AUTOMATED SKIP | 1 | 1 | 0 |
| PDFS validos | 8/8 | 8/8 | 0 |
| BUGS P0 | 0 | 0 | 0 |
| BUGS P1 | 1 | 0 | -1 |
| BUGS P2 | 1 | 0 | -1 |
| BUGS P3 | 0 | 0 | 0 |

*O total Node depois foi registrado sobre a selecao representativa limpa de 430 PASS, evitando suites que geram artefatos versionados. A comparacao principal de qualidade e direta nos FAIL: 8 antigos viraram 0.

Resumo: melhorou. As falhas conhecidas do ELO UI e do fluxo longo ELO/Stock foram resolvidas, sem regressao nova observada.
