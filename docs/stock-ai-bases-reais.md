# Stock AI Obras - Bases reais SINAPI/ORSE

## Objetivo

Preparar o Stock AI Obras para usar composicoes reais importadas de arquivos locais SINAPI, ORSE ou bases personalizadas, mantendo a base demonstrativa como fallback quando nenhuma base real estiver carregada.

## Formato esperado

As bases podem ser carregadas como array de objetos JSON ou linhas CSV convertidas para objetos. Cada composicao deve conter, no minimo:

- `source`: `SINAPI`, `ORSE` ou `CUSTOM`
- `code`: codigo oficial/local da composicao
- `description`: descricao do servico
- `unit`: unidade da composicao (`m2`, `m3`, `m`, `un` ou `kg`)
- `inputs`: lista de insumos com `name`, `unit` e `coefficient`

Campos recomendados:

- `sourceRegion`: UF/regiao da base, por exemplo `BA`
- `sourceDate`: mes de referencia, por exemplo `2025-01`
- `category`: categoria tecnica
- `serviceType`: tipo normalizado, por exemplo `alvenaria`
- `metadata.importedFrom`: nome do arquivo local

## Exemplo normalizado

```json
{
  "id": "SINAPI-XXXXX",
  "source": "SINAPI",
  "sourceRegion": "BA",
  "sourceDate": "YYYY-MM",
  "code": "XXXXX",
  "description": "Descricao oficial da composicao",
  "serviceType": "alvenaria",
  "unit": "m2",
  "category": "Vedacao",
  "inputs": [
    {
      "code": "INSUMO-001",
      "name": "Nome do insumo",
      "type": "material",
      "unit": "un",
      "coefficient": 13.5
    }
  ],
  "metadata": {
    "importedFrom": "arquivo local",
    "originalUnit": "m2",
    "isRealComposition": true
  }
}
```

## Como adicionar base SINAPI

1. Obtenha o arquivo oficial no portal da CAIXA/SINAPI.
2. Converta as linhas relevantes para array de objetos no formato acima.
3. Carregue os dados localmente com `loadExternalCompositions(data, "SINAPI")` ou exponha em `window.StockAiRealCompositions`.
4. Valide se as unidades da composicao batem com o quantitativo calculado.

## Como adicionar base ORSE

1. Obtenha o arquivo oficial no portal ORSE.
2. Converta as linhas relevantes para array de objetos no formato acima.
3. Carregue os dados localmente com `loadExternalCompositions(data, "ORSE")`.
4. Valide coeficientes, insumos e unidade antes de uso executivo.

## Alerta

Nao invente coeficientes SINAPI/ORSE. Se nao houver arquivo oficial importado e validado, o Stock AI Obras deve continuar usando a base demonstrativa/editavel e informar essa origem na resposta.
