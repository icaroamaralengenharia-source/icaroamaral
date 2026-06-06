# Stock AI Obras - Adaptador SINAPI Analitico

Este guia documenta a Fase 2.0E: adaptador especifico para o formato analitico real SINAPI da Caixa.

Arquivo de referencia:

```text
SINAPI_Custo_Ref_Composicoes_Analitico_BA_202412_Desonerado.xlsx
```

## Objetivo

Ler o formato analitico do SINAPI e converter automaticamente suas linhas para o formato interno do Stock AI Obras, sem exigir `columnMap` manual.

O adaptador nao baixa arquivos, nao altera dados oficiais e nao inventa coeficientes.

## Cabecalhos reconhecidos

O adaptador procura a linha real de cabecalho dentro da planilha, mesmo quando existem metadados no topo.

Cabecalhos obrigatorios:

- `CODIGO DA COMPOSICAO`
- `DESCRICAO DA COMPOSICAO`
- `UNIDADE`
- `TIPO ITEM`
- `CODIGO ITEM`
- `DESCRIÇÃO ITEM`
- `UNIDADE ITEM`
- `COEFICIENTE`

Campos de custo como `PRECO UNITARIO` e `CUSTO TOTAL` podem existir na planilha, mas nesta fase nao alimentam orcamento/custos.

## Metadados ignorados

Linhas superiores como estas sao ignoradas ate o cabecalho real:

- `PCI.818.01`
- `DATA DE EMISSAO`
- `DATA DE RT`
- `ENCARGOS SOCIAIS`
- `ABRANGENCIA`
- `REFERENCIA DE COLETA`
- `DATA DE PRECO`

Quando possivel, o adaptador tenta extrair o mes de referencia de `DATA DE PRECO`, por exemplo `12/2024` -> `2024-12`.

## Conversao para o formato interno

Mapeamento aplicado:

- `compositionCode` = `CODIGO DA COMPOSICAO`
- `compositionName` = `DESCRICAO DA COMPOSICAO`
- `compositionUnit` = `UNIDADE`
- `inputCode` = `CODIGO ITEM`
- `inputName` = `DESCRIÇÃO ITEM`
- `inputUnit` = `UNIDADE ITEM`
- `coefficient` = `COEFICIENTE`

As linhas sao agrupadas por `CODIGO DA COMPOSICAO`.

## INSUMO e COMPOSICAO

Quando `TIPO ITEM` for `INSUMO`, o item entra como insumo normal.

Quando `TIPO ITEM` for `COMPOSICAO` ou `COMPOSIÇÃO`, o item tambem entra como input, mas com tipo preservado como item composto. Composicoes auxiliares nao sao descartadas.

Outros tipos sao preservados quando existirem, sem quebrar a importacao.

## Como importar pela interface

1. Abra `stock-ai-obras.html`.
2. Selecione `SINAPI`.
3. Informe a UF, por exemplo `BA`.
4. Informe o mes de referencia, por exemplo `2024-12`.
5. Selecione o XLSX analitico.
6. Clique em **Validar arquivo**.
7. Se a biblioteca XLSX estiver disponivel no navegador e o formato for reconhecido, a interface mostra:

```text
Formato SINAPI Analitico detectado.
```

8. Clique em **Importar base**.

Se XLSX nao estiver disponivel no navegador, a interface mantem o fallback seguro e recomenda usar CSV nesta fase ou o fluxo backend/testes.

## Funcoes disponiveis

- `detectSinapiAnaliticoFormat(workbookOrRows)`
- `parseSinapiAnaliticoRows(rows, options)`
- `parseSinapiAnaliticoXlsx(fileOrBuffer, options)`
- `importSinapiAnaliticoXlsx(fileOrBuffer, options)`

## Limitacoes

- Nao versionar arquivos oficiais grandes no repositorio.
- Nao baixa arquivo da internet.
- Nao calcula custo/orcamento nesta fase.
- Suporte XLSX no browser depende de `window.XLSX`.
- Persistencia backend ainda nao foi implementada.

## Proximos passos

- Suporte completo no browser para XLSX.
- Persistencia backend da base oficial importada.
- Busca inteligente oficial.
- Custos/orcamento com campos de preco e custo total.

