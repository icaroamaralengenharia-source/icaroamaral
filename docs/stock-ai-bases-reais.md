# Stock AI Obras - Bases reais SINAPI/ORSE

## Objetivo

Preparar o Stock AI Obras para usar composicoes reais importadas de arquivos locais SINAPI, ORSE ou bases personalizadas, mantendo a base demonstrativa como fallback quando nenhuma composicao externa compativel estiver carregada.

Esta etapa nao implementa upload visual no navegador. Ela cria um fluxo local controlado para receber JSON ou linhas CSV ja parseadas, validar schema, normalizar campos e registrar um catalogo externo em memoria.

## Formato JSON aceito

O importador aceita um array direto ou um objeto com `compositions`, `rows` ou `items`.

```json
[
  {
    "source": "SINAPI",
    "sourceRegion": "BA",
    "sourceDate": "YYYY-MM",
    "code": "CODIGO-OFICIAL",
    "description": "Descricao oficial da composicao",
    "serviceType": "alvenaria",
    "unit": "m2",
    "inputs": [
      {
        "code": "INSUMO-001",
        "name": "Nome do insumo",
        "unit": "un",
        "coefficient": 1.23
      }
    ]
  }
]
```

## Formato CSV parseado aceito

O motor nao faz leitura de arquivo CSV nesta etapa. Ele recebe linhas ja convertidas para objetos JavaScript:

```js
const rows = [
  {
    code: "CODIGO-OFICIAL",
    description: "Descricao oficial da composicao",
    serviceType: "alvenaria",
    unit: "m2",
    sourceRegion: "BA",
    sourceDate: "YYYY-MM",
    inputs: [
      { name: "Nome do insumo", unit: "un", coefficient: 1.23 }
    ]
  }
];

const result = StockAiCompositionEngine.loadRealCompositionsFromRows(rows, {
  source: "SINAPI"
});
```

Quando `source` for `SINAPI` ou `ORSE`, a fonte e aplicada nas linhas antes da validacao.

## Campos obrigatorios

Cada composicao importada deve conter:

- `source`
- `code`
- `description`
- `unit`
- `serviceType` ou `description` suficiente para inferir o tipo de servico
- `inputs` com pelo menos 1 item valido

Cada input deve conter:

- `name`
- `unit`
- `coefficient` numerico maior que zero

Unidades normalizadas nesta etapa:

- `m2`, `m²`, `metro quadrado` -> `m2`
- `m3`, `m³`, `metro cubico` -> `m3`
- `metro`, `metros`, `m` -> `m`
- `un`, `und`, `unidade` -> `un`
- `kg`, `quilo`, `quilos` -> `kg`

## Importar JSON

```js
const result = StockAiCompositionEngine.loadRealCompositionsFromJson(jsonData);

if (result.ok) {
  StockAiCompositionEngine.setExternalCompositionCatalog(result.imported);
}
```

Retorno:

```json
{
  "ok": false,
  "imported": [],
  "rejected": [
    {
      "index": 0,
      "code": "CODIGO-OFICIAL",
      "source": "SINAPI",
      "reasons": ["Input 1 sem coefficient numerico maior que zero."]
    }
  ],
  "summary": {
    "total": 1,
    "valid": 0,
    "invalid": 1,
    "sources": {}
  }
}
```

## Registrar catalogo externo

```js
const importResult = StockAiCompositionEngine.setExternalCompositionCatalog(compositions);
const activeCatalog = StockAiCompositionEngine.getExternalCompositionCatalog();

StockAiCompositionEngine.clearExternalCompositionCatalog();
```

O catalogo externo fica apenas em memoria. O `findBestComposition` e o calculo do Stock AI Obras consultam esse catalogo junto da base demonstrativa.

## Prioridade e fallback

- Se houver composicao externa SINAPI compativel com o servico e a unidade, ela tem prioridade.
- Se houver composicao externa ORSE compativel, ela tem prioridade sobre a demonstrativa.
- Se a unidade externa for incompativel, ela e ignorada sem quebrar o calculo.
- Se nao houver composicao externa compativel, a base demonstrativa/editavel continua como fallback.

Quando uma composicao importada real for usada, a resposta deve indicar:

```text
Fonte: SINAPI - codigo XXXXX - referencia YYYY-MM
Fonte: ORSE - codigo XXXXX - referencia YYYY-MM
```

Fixtures de teste devem ser marcadas com `isMock: true` e `mockOnly: true`. Quando usadas em teste, a resposta deve deixar claro:

```text
Fonte: MOCK DE TESTE - nao usar como base real
```

## Aviso tecnico

Nao invente coeficientes SINAPI/ORSE. Se nao houver arquivo oficial importado, validado e compativel, o Stock AI Obras deve continuar usando a base demonstrativa/editavel e informar essa origem.

O arquivo `relatorio-qualidade-obras/stock-ai-real-compositions-sample.json` e uma fixture de teste. Nao representa composicao real SINAPI/ORSE.

## Proximo passo futuro

Adicionar upload visual de arquivo pela interface para selecionar JSON/CSV local, parsear as linhas, exibir `imported/rejected` ao usuario e registrar o catalogo externo somente depois da confirmacao.
