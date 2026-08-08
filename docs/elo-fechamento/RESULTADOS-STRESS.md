# Resultados de stress

## Stress final de 200 cenários

TOTAL: 200
PASS: 139
PASS_COM_RESSALVA: 61
FALHA_FUNCIONAL: 0
FALHA_INFRA: 0
ALUCINACAO: 0
NAO_CONECTADO: 0
INCONCLUSIVO: 0
NAO_EXECUTADO: 0
NOTA MÉDIA: 18.79/25

Interpretação: 200/200 foram funcionalmente executados sem falha funcional, mas 61 tiveram ressalvas de qualidade. As ressalvas não devem ser escondidas nem convertidas em PASS.

## Evolução sobre stress anterior

Resultado anterior informado: 196 PASS, 3 PASS_COM_RESSALVA, 1 FALHA_FUNCIONAL, nota 19.96/25.

A falha funcional crítica foi eliminada. A metodologia final foi mais rigorosa e gerou mais ressalvas, por isso a nota média caiu para 18.79/25. Essa queda não significa necessariamente regressão funcional, mas mostra que ainda há trabalho de qualidade textual/aderência.

## Cenário âncora CBUQ

Status: PASS.

O ELO comprovou que consegue interpretar 1.200 m de CBUQ, identificar 92% versus requisito informado de 96%, calcular diferença de 4 pontos percentuais, considerar exsudação, considerar afundamento/trilha de roda, separar alegação de liberação precoce de fato comprovado, elaborar resposta de fiscalização e propor providências prudentes sem inventar DNIT, ABNT, NBR, processo, prazo, multa, glosa definitiva ou sanção.

## Bugs exploratórios e decisões

| ID | Problema | Status final | Commit/fix | Resultado |
|---|---|---|---|---|
| 30 | PDF/análise visual | Publicado | 840c492 | leitura/visual preservados |
| 33 | parede rachando | Publicado | 1c02552 | patologia priorizada |
| 36 | encoding orçamento/PDF V2 | Publicado | 7f23d9f | encoding corrigido |
| 39 | harness legado do roteador | Publicado | a585329 | testes/harness alinhados |
| 40 | fiscalização técnica complexa | Publicado | 34b82c4 | fiscalizacao_tecnica reconhecida |
| 53 | rachou/destacamento/eflorescência | Publicado | a5713c6 / 29561dc | patologia reconhecida |
| 54 | RDO como contexto técnico | Publicado | 4ceba40 / 0d653fd | RDO não rouba análise técnica explícita |
| 58 | objeto técnico x CADISTA | Publicado | b80fb60 | CADISTA legítimo preservado; patologia não vira desenho |
| 60 | pavimento/exsudação/trilhas/relatório NC | Publicado | 98da6b0 / 6478df2 / 04d891c | fiscalização de pavimento preservada |
| 63 | RDO + patologia sem composição | Publicado | cb501fe | patologia vence composição negada |
| 65 | patologia antes de orçamento | Publicado | ef241ac | análise técnica antes do orçamento |
| 31 | alegação não documentada + notificação | Publicado | 8242b46 | fiscalização técnica vence conceito “Existe” |
| 62 | RDO -> análise técnica composta | Melhoria futura | Sem fix | sem RDO é seguro; com RDO falta encadeamento composto |
