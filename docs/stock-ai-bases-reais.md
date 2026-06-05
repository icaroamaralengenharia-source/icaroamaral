# Stock AI Obras - Bases reais SINAPI/ORSE

## Objetivo

Preparar o Stock AI Obras para usar composicoes reais importadas de arquivos locais SINAPI, ORSE ou bases personalizadas, mantendo a base demonstrativa como fallback quando nenhuma composicao externa compativel estiver carregada.

Esta etapa permite importar JSON pela interface do Stock AI Obras e tambem receber JSON ou linhas CSV ja parseadas via JavaScript, validar schema, normalizar campos e registrar um catalogo externo em memoria.

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

## Importar pela interface

Na pagina `stock-ai-obras.html`, use a secao **Importar base de composicoes**:

1. Clique em **Selecionar arquivo JSON** e escolha um arquivo no formato aceito.
2. Clique em **Importar base**.
3. Confira o status com composicoes importadas, rejeitadas, fonte detectada e aviso de mock quando aplicavel.
4. Use o chat normalmente. Quando houver composicao importada compativel, o Stock AI Obras prioriza SINAPI/ORSE ou a fonte importada sobre a base demonstrativa.
5. Para voltar ao fallback, clique em **Limpar base importada**.

A importacao pela interface usa `FileReader`, `JSON.parse`, `loadRealCompositionsFromJson(jsonData)` e `setExternalCompositionCatalog(result.imported)`.

Se houver rejeicoes, a tela mostra a quantidade rejeitada e ate tres motivos principais. A pagina nao deve quebrar quando o arquivo tiver composicoes invalidas.

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

O catalogo externo fica apenas em memoria da pagina. O `findBestComposition` e o calculo do Stock AI Obras consultam esse catalogo junto da base demonstrativa.

Ainda nao ha persistencia em banco de dados, por cliente ou por obra. Ao recarregar a pagina, a base importada precisa ser carregada novamente.

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

Adicionar persistencia por cliente/obra, com historico da fonte importada, referencia, responsavel pela validacao e escopo de uso da base.
