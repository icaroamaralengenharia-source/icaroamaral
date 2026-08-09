# INTEGRACOES

| Integracao | Status depois | Evidencia |
|---|---:|---|
| ELO <-> RDO | PASS_COM_RESSALVA | Roteador/RDO e materialRequests preservados; encadeamento automatico RDO->analise tecnica segue ressalva quando sem pedido explicito. |
| ELO <-> orcamento | PASS | Cenario de continuidade de orcamento na spec ELO mobile passou. |
| ELO <-> Stock | PASS | Fluxo longo Almoxarifado/Stock/ELO passou; falha antiga resolvida. |
| ELO <-> documentos/PDF | PASS | report-image-bridge e PDF profissional passaram nos testes formais. |
| RDO <-> estoque | PASS | rdo-material-requests-anti-duplication passou. |
| Stock <-> patrimonio | PASS_COM_RESSALVA | Municipal/patrimonio passou em Node e Playwright; depende de ambiente e perfis. |
| Sentinela <-> modulos | PASS_COM_RESSALVA | Sentinela Node e UI passaram; decisao continua humana. |
| PDF <-> dados | PASS_COM_RESSALVA | PDFs Stock Full e ponte ELO/ObraReport passaram; QA visual integral nao declarado. |
| CADISTA | FORA_DE_ESCOPO | Congelado, sem teste e sem nota. |
