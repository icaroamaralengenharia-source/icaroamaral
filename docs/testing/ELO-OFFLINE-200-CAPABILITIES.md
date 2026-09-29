# ELO — Offline Capability Matrix (200)

A matriz executável está em `backend/tests/elo-step14-offline-contract.test.cjs` e é gerada de `EloOfflineCapabilityRegistry`. O teste exige 200 IDs únicos, 20 categorias e zero chamadas de rede para os casos locais.

| IDs | Categoria | Rota esperada | Resultado | Status do contrato |
|---|---|---|---|---|
| 001–010 | IDENTIDADE | LOCAL | ANSWER | PASS |
| 011–020 | CONNECTIVITY | LOCAL | STATE | PASS |
| 021–030 | DATE_TIME | LOCAL | ANSWER | PASS |
| 031–040 | CALCULATOR | LOCAL | ANSWER | PASS |
| 041–050 | CONVERSIONS | LOCAL | ANSWER | PASS |
| 051–060 | GEOMETRY | LOCAL | ANSWER | PASS |
| 061–070 | CONSTRUCTION_QUANTITIES | LOCAL | ANSWER | PASS |
| 071–080 | ENGINEERING | LOCAL | ANSWER | PASS |
| 081–090 | TECH_LIBRARY | LOCAL | ANSWER | PASS |
| 091–100 | MEMORY_CONTEXT | LOCAL | ANSWER | PASS |
| 101–110 | APP_CONTROLS | LOCAL | ANSWER | PASS |
| 111–120 | LOCAL_FILES | LOCAL | ANSWER | PASS |
| 121–130 | RDO | LOCAL | LOCAL_DATA | PASS |
| 131–140 | STOCK | LOCAL | LOCAL_DATA | PASS |
| 141–150 | VISTORIA | LOCAL | LOCAL_DATA | PASS |
| 151–160 | MUSIC | LOCAL | ANSWER | PASS |
| 161–170 | VOICE | LOCAL | ANSWER | PASS |
| 171–180 | UX_ERRORS | LOCAL | ANSWER | PASS |
| 181–190 | SECURITY | LOCAL | ANSWER | PASS |
| 191–200 | CONTINUITY_SYNC | LOCAL | ANSWER | PASS |

O status `PASS` acima significa que a entrada está registrada, escopada para execução local e coberta pelo contrato de ausência de rede. Ele não autoriza afirmar que um snapshot de obra, arquivo ou draft existe no dispositivo: esses resultados dependem de fixture/dado local válido.
