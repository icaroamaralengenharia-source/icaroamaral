# Manual Integracoes

Status: operacional assistido.
Classificacao: COMPROVADA_COM_RESSALVA.

## Integracoes com evidencia final

| Integracao | Estado | Observacao |
|---|---:|---|
| ELO <-> RDO | PASS_COM_RESSALVA | Consulta e contexto preservados; encadeamento tecnico automatico ainda parcial sem pedido explicito. |
| ELO <-> Orcamento | PASS | Continuidade de contexto corrigida, publicada e revalidada. |
| ELO <-> Stock/Almoxarifado | PASS | Fluxo longo anteriormente instavel foi reexecutado e passou sem timeout. |
| ELO <-> documentos/PDF | PASS | Ponte de imagem/PDF e orcamento documentados e testados. |
| Stock <-> Patrimonio/Municipal | PASS_COM_RESSALVA | Evidencias em testes municipais e isolamentos; depende de ambiente/perfis. |
| RDO <-> estoque | PASS | materialRequests e entregas sem duplicacao indevida. |
| Sentinela <-> modulos ativos | PASS_COM_RESSALVA | Evidencias, alertas e validacao humana passaram; depende de ambiente e permissao. |
| PDF <-> dados | PASS_COM_RESSALVA | 8/8 fluxos validos; QA visual integral nao declarado. |
| CADISTA | FORA_DE_ESCOPO | Congelado, nao integrar nesta rodada. |

## Regra de operacao

Nunca assumir que uma integracao externa esta viva sem testar credenciais, backend, rede e permissao. Mesmo com o fluxo ELO/Stock aprovado, piloto real deve manter monitoramento e suporte.
