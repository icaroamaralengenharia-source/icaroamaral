# Stock AI Obras - assistente de preenchimento de composicao oficial

## Objetivo

O assistente de preenchimento analisa um JSON de composicao oficial SINAPI/ORSE antes da importacao. Ele nao consulta fontes externas, nao baixa tabelas e nao inventa coeficientes. A funcao apenas mostra o que esta pronto e o que ainda falta preencher manualmente.

## Funcao disponivel

Use `StockAiCompositionEngine.analyzeOfficialCompositionReadiness(jsonData)`.

Retorno principal:

```json
{
  "ready": false,
  "score": 65,
  "status": "Parcialmente preenchida",
  "errors": [],
  "warnings": [],
  "checklist": []
}
```

## Checklist analisado

Composicao:

- codigo preenchido
- descricao preenchida
- unidade preenchida
- referencia preenchida
- `sourceType` igual a `official_manual_entry`
- `isOfficial` igual a `true`

Referencia:

- UF preenchida
- mes de referencia preenchido

Insumos:

- possui insumos
- todos os insumos possuem codigo
- todos os insumos possuem unidade
- todos os insumos possuem `coefficient > 0`

## Interpretacao do score

- `0` a `39`: incompleta.
- `40` a `79`: parcialmente preenchida.
- `80` a `99`: quase pronta.
- `100`: pronta para importacao, desde que o validador estrito tambem aprove.

## Erros comuns

- `referenceMonth` ausente ou ainda como `AAAA-MM`.
- `state` ausente ou ainda como `UF`.
- `code` da composicao vazio.
- `reference` sem a fonte oficial consultada.
- Insumo sem codigo oficial.
- Insumo sem unidade oficial.
- `coefficient` zerado, vazio ou negativo.
- Arquivo marcado como `MOCK` ou `TEST ONLY` tentando passar por base real.

## Exemplo de validacao

Um arquivo com insumo `CIMENTO CP II` e coeficiente zerado deve retornar uma mensagem objetiva:

```text
Coeficiente oficial ausente no insumo CIMENTO CP II. Preencha o valor oficial antes da importacao.
```

## Como usar no fluxo manual

1. Preencha `relatorio-qualidade-obras/bases-reais/primeira-composicao-real.example.json` com dados oficiais.
2. Rode a analise de prontidao.
3. Corrija todos os erros.
4. Confirme score `100`.
5. Importe pela interface somente depois da validacao estrita aprovar.

## Limites

O assistente nao garante que os valores digitados sao oficiais. Ele apenas confirma que os campos obrigatorios foram preenchidos e que os coeficientes informados sao maiores que zero. A conferencia com a fonte SINAPI/ORSE continua sendo manual e obrigatoria.
