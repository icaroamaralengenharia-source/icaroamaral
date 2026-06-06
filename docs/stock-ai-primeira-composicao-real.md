# Stock AI Obras - primeira composicao real oficial controlada

## Objetivo da fase 1.7C

Preparar a entrada manual de 1 composicao oficial SINAPI/ORSE no Stock AI Obras, sem inventar coeficientes, sem converter template/mock em base real e sem quebrar o fallback demonstrativo.

## Como obter a composicao oficial

1. Acesse a fonte oficial SINAPI ou ORSE pelo canal institucional usado pela obra.
2. Escolha uma composicao pequena, preferencialmente com 1 a 5 insumos para a primeira validacao.
3. Confira UF, mes de referencia, codigo, descricao, unidade e lista de insumos.
4. Use apenas dados oficiais ou documento tecnico auditavel.

## O que copiar da fonte oficial

- Codigo oficial da composicao.
- Descricao oficial completa.
- Unidade da composicao.
- Mes de referencia.
- UF ou regiao da base.
- Codigo, nome, unidade e coeficiente oficial de cada insumo.
- Referencia oficial usada para auditoria.

## Como preencher o JSON

Use `relatorio-qualidade-obras/bases-reais/primeira-composicao-real.example.json` como modelo preenchivel.

- `source`: `SINAPI` ou `ORSE`.
- `sourceType`: manter `official_manual_entry`.
- `referenceMonth`: mes oficial no formato `AAAA-MM`.
- `state`: UF da base oficial.
- `code`: codigo oficial da composicao.
- `name`: descricao oficial da composicao.
- `unit`: unidade oficial da composicao.
- `reference`: referencia oficial consultada.
- `metadata.manualReviewRequired`: manter `true` para confirmar revisao manual.
- `inputs[].code`: codigo oficial do insumo.
- `inputs[].name`: nome oficial do insumo.
- `inputs[].unit`: unidade oficial do insumo.
- `inputs[].coefficient`: coeficiente oficial maior que zero.

## Como importar pela interface

1. Abra `stock-ai-obras.html`.
2. Use a importacao de composicoes ja criada na interface.
3. Selecione o JSON revisado com 1 composicao oficial.
4. Verifique se a importacao informa fonte `SINAPI` ou `ORSE`.
5. Pergunte: `Tenho uma parede de 12 m por 3 m`.
6. Confirme se a resposta mostra `Fonte: SINAPI` ou `Fonte: ORSE`, com codigo, referencia e UF.
7. Limpe a base importada para voltar ao catalogo demonstrativo.

## Como validar antes de importar

- O arquivo nao pode conter placeholders como `PREENCHER_CODIGO_OFICIAL`.
- Nenhum `coefficient` pode ser `0`, vazio ou negativo.
- `sourceType` deve ser `official_manual_entry`.
- `isOfficial` deve ser `true`.
- `referenceMonth` e `state` devem estar preenchidos.
- `metadata.manualReviewRequired` deve ser `true` para confirmar revisao manual.

## O que nao fazer

- Nao inventar coeficiente.
- Nao usar print sem conferencia com a fonte oficial.
- Nao misturar mock com composicao oficial.
- Nao chamar base demonstrativa de SINAPI/ORSE.
- Nao importar template ou example como se fosse base pronta.
- Nao usar composicao sem mes, UF, codigo, descricao, unidade e referencia.

## Exemplo ainda nao preenchido

O arquivo `primeira-composicao-real.example.json` contem a estrutura completa, mas permanece invalido enquanto tiver placeholders e `coefficient: 0`.

## Checklist antes de importar

- [ ] Fonte oficial confirmada.
- [ ] Mes de referencia preenchido.
- [ ] UF preenchida.
- [ ] Codigo oficial preenchido.
- [ ] Descricao oficial preenchida.
- [ ] Unidade da composicao preenchida.
- [ ] Todos os insumos preenchidos.
- [ ] Todos os coeficientes oficiais sao maiores que zero.
- [ ] Arquivo nao contem `MOCK`, `PREENCHER`, `CODIGO_OFICIAL` ou dados demonstrativos.
- [ ] Base demonstrativa continua sendo fallback apos limpar o catalogo externo.
