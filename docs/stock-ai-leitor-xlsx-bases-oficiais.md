# Stock AI Obras - Leitor XLSX para bases oficiais SINAPI/ORSE

Este guia documenta a Fase 2.0C: leitura local de planilhas XLSX ja obtidas pelo usuario e conversao para linhas normalizadas do importador oficial.

O leitor XLSX nao baixa arquivos, nao consulta internet e nao cria coeficientes. Ele apenas interpreta uma planilha fornecida localmente e encaminha os dados para as validacoes oficiais do Stock AI Obras.

## Objetivo

Converter planilhas XLSX exportadas ou preparadas a partir de bases SINAPI/ORSE em um fluxo seguro:

XLSX -> rows -> importador -> catalogo

Se a planilha falhar no parsing ou na validacao, a base oficial importada anteriormente permanece intacta.

## Dependencia usada

A leitura XLSX usa a biblioteca `xlsx`, adicionada ao backend para testes e processamento local em ambiente Node.

O motor tambem aceita um workbook ja carregado ou uma instancia `XLSX` injetada por `options.xlsx`/`window.XLSX`.

## Formato minimo esperado

Cada linha da planilha deve representar um insumo de uma composicao.

Colunas minimas:

- `compositionCode`
- `compositionName`
- `compositionUnit`
- `inputCode`
- `inputName`
- `inputUnit`
- `coefficient`

Tambem devem ser informados nas opcoes:

- `source`: `SINAPI` ou `ORSE`
- `state`: UF
- `referenceMonth`: mes de referencia

## Exemplo de colunas

```text
compositionCode | compositionName | compositionUnit | inputCode | inputName | inputUnit | coefficient
PREENCHER       | PREENCHER       | m2              | PREENCHER | PREENCHER | un        | PREENCHER
```

Nao use esse exemplo como composicao real. Substitua os campos por dados oficiais conferidos.

## Uso com sheetName

Quando a planilha tiver varias abas, informe `sheetName` para selecionar a aba correta.

```js
parseOfficialBaseXlsx(fileBuffer, {
  source: "SINAPI",
  state: "BA",
  referenceMonth: "2025-12",
  sheetName: "Composicoes"
});
```

Se `sheetName` nao for informado, o leitor usa a primeira aba com dados validos e ignora abas vazias.

## Uso com columnMap

Use `columnMap` quando a planilha tiver nomes de colunas proprios.

```js
parseOfficialBaseXlsx(fileBuffer, {
  source: "SINAPI",
  state: "BA",
  referenceMonth: "2025-12",
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

Valores como `12,50` sao preservados na leitura e convertidos pelo normalizador oficial.

Cuidados:

- confira se o XLSX nao transformou coeficientes em texto truncado;
- mantenha casas decimais oficiais;
- nao invente coeficientes;
- nao misture base demonstrativa com base oficial.

## Funcoes disponiveis

- `parseOfficialBaseXlsx(fileOrBuffer, options)`: le XLSX e retorna rows normalizados.
- `importOfficialBaseXlsx(fileOrBuffer, options)`: le, valida e importa a base oficial se tudo estiver correto.

Entradas aceitas:

- `Buffer`
- `ArrayBuffer`
- `Uint8Array`
- workbook ja carregado pela biblioteca `xlsx`
- caminho local somente quando `options.readFile` for fornecido em ambiente seguro

## Validacoes

O leitor rejeita:

- arquivo vazio;
- planilha sem abas;
- aba vazia;
- aba sem cabecalhos minimos;
- `source` diferente de SINAPI/ORSE;
- `state` vazio;
- `referenceMonth` vazio;
- `sheetName` inexistente.

O importador oficial continua rejeitando:

- coefficient ausente, zero ou negativo;
- placeholders;
- template/example;
- MOCK ou TEST ONLY.

## Limitacoes

- Ainda nao baixa arquivo da internet.
- Ainda nao tem interface de upload.
- Ainda nao importa ZIP automaticamente.
- Ainda depende de colunas reconheciveis ou de `columnMap`.

## Proximos passos

- Interface de upload com diagnostico antes da importacao.
- Importador ZIP para pacotes oficiais, se o formato for mapeado.
- Relatorio de divergencias entre XLSX, rows normalizados e catalogo importado.

