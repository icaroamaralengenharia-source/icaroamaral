# Stock AI Obras - Leitor CSV para bases oficiais SINAPI/ORSE

Este guia documenta a Fase 2.0B: conversao de CSV local em linhas normalizadas para o importador oficial do Stock AI Obras.

O leitor CSV nao baixa arquivos, nao consulta internet e nao cria coeficientes. Ele apenas transforma um CSV ja conferido pelo usuario em `rows` compativeis com `importOfficialBase()`.

## Objetivo

Converter exportacoes CSV de SINAPI/ORSE em um formato unico, validavel e seguro:

CSV -> rows -> importador -> catalogo

Se o CSV falhar no parsing ou na validacao, a base oficial importada anteriormente permanece intacta.

## Formato minimo esperado

Cada linha do CSV deve representar um insumo de uma composicao.

Campos minimos:

- codigo da composicao
- descricao da composicao
- unidade da composicao
- codigo do insumo
- descricao ou nome do insumo
- unidade do insumo
- coeficiente oficial

Tambem devem ser informados nas opcoes:

- `source`: `SINAPI` ou `ORSE`
- `state`: UF
- `referenceMonth`: mes de referencia

## Exemplo CSV com ponto e virgula

```csv
compositionCode;compositionName;compositionUnit;inputCode;inputName;inputUnit;coefficient
PREENCHER;PREENCHER;m2;PREENCHER;PREENCHER;un;PREENCHER
```

Uso:

```js
parseOfficialBaseCsv(csvText, {
  source: "SINAPI",
  state: "BA",
  referenceMonth: "2025-12",
  delimiter: ";"
});
```

## Exemplo CSV com virgula

Quando o separador for virgula e o coeficiente tambem usar virgula decimal, coloque o valor entre aspas.

```csv
compositionCode,compositionName,compositionUnit,inputCode,inputName,inputUnit,coefficient
PREENCHER,PREENCHER,m2,PREENCHER,PREENCHER,un,"PREENCHER"
```

Uso:

```js
parseOfficialBaseCsv(csvText, {
  source: "ORSE",
  state: "SE",
  referenceMonth: "2025-12",
  delimiter: ","
});
```

## columnMap

Use `columnMap` quando o CSV tiver nomes de colunas proprios.

```js
parseOfficialBaseCsv(csvText, {
  source: "SINAPI",
  state: "BA",
  referenceMonth: "2025-12",
  delimiter: ";",
  columnMap: {
    compositionCode: "COD_COMP",
    compositionName: "DESC_COMP",
    compositionUnit: "UN_COMP",
    inputCode: "COD_INSUMO",
    inputName: "DESC_INSUMO",
    inputUnit: "UN_INSUMO",
    coefficient: "COEF"
  }
});
```

## Decimal com virgula

O leitor preserva valores como `12,50` e o importador converte para numero.

Cuidados:

- Em CSV com `;`, `12,50` pode ficar sem aspas.
- Em CSV com `,`, use `"12,50"` para nao quebrar a coluna.
- Nao invente coeficientes. Copie somente coeficientes oficiais conferidos.

## Fluxo completo

1. Obter CSV oficial ou exportacao CSV ja conferida.
2. Executar `parseOfficialBaseCsv(csvText, options)`.
3. Conferir `rows`, `headers`, `delimiter` e `errors`.
4. Executar `importOfficialBaseCsv(csvText, options)`.
5. Buscar composicao com `searchImportedOfficialCompositions(query)`.
6. Testar consumo previsto compativel.
7. Limpar a base com `clearImportedOfficialBase()` quando o teste acabar.

## Validacoes

O leitor rejeita:

- CSV vazio.
- CSV sem cabecalho.
- CSV sem colunas minimas.
- `source` diferente de SINAPI/ORSE.
- `state` vazio.
- `referenceMonth` vazio.

O importador continua rejeitando:

- coeficiente zero, negativo ou ausente.
- placeholders.
- template/example.
- MOCK ou TEST ONLY.

## Limitacoes

- Ainda nao le XLSX/ZIP diretamente.
- Ainda nao faz download automatico.
- Ainda nao possui interface de upload.
- Ainda nao interpreta todas as variacoes possiveis de arquivos oficiais sem `columnMap`.

## Proximos passos

- Leitor XLSX.
- Leitor ZIP quando o pacote oficial estiver mapeado.
- Interface de upload com diagnostico antes da importacao.
- Relatorio de divergencias entre CSV, rows e catalogo importado.

