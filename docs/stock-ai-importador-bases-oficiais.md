# Stock AI Obras - Importador local de bases oficiais SINAPI/ORSE

Este guia documenta a Fase 2.0A do Stock AI Obras: um importador local e seguro para composicoes oficiais SINAPI/ORSE ja obtidas pelo usuario.

O Stock AI nao baixa tabelas, nao consulta fontes externas e nao cria codigos ou coeficientes. Os dados oficiais devem vir de arquivo oficial ja conferido pelo responsavel tecnico.

## Objetivo

Permitir que uma pequena base oficial normalizada entre no motor como catalogo prioritario, sem substituir o catalogo demonstrativo e sem misturar templates, mocks ou exemplos com composicoes oficiais.

Prioridade do motor:

1. Base oficial importada localmente.
2. Catalogo externo/manual controlado.
3. Catalogo demonstrativo/editavel.
4. Fallback demonstrativo.

## Formato aceito

Nesta fase o formato principal e uma lista JSON de linhas normalizadas. Cada linha representa um insumo de uma composicao.

```json
{
  "rows": [
    {
      "source": "SINAPI",
      "state": "BA",
      "referenceMonth": "2026-01",
      "compositionCode": "CODIGO_OFICIAL_DA_COMPOSICAO",
      "compositionName": "DESCRICAO_OFICIAL_DA_COMPOSICAO",
      "compositionUnit": "m2",
      "serviceType": "alvenaria",
      "inputCode": "CODIGO_OFICIAL_DO_INSUMO",
      "inputName": "NOME_OFICIAL_DO_INSUMO",
      "inputUnit": "un",
      "coefficient": "12,50"
    }
  ]
}
```

Linhas com o mesmo `source`, `state`, `referenceMonth` e `compositionCode` sao agrupadas em uma unica composicao.

## Campos obrigatorios

- `source`: somente `SINAPI` ou `ORSE`.
- `state`: UF da base oficial.
- `referenceMonth`: mes de referencia da base oficial.
- `compositionCode`: codigo oficial da composicao.
- `compositionName`: descricao oficial da composicao.
- `compositionUnit`: unidade oficial da composicao.
- `inputCode`: codigo oficial do insumo.
- `inputName`: nome oficial do insumo.
- `inputUnit`: unidade oficial do insumo.
- `coefficient`: coeficiente oficial maior que zero.

O importador aceita decimal com virgula, por exemplo `12,50`, e converte para numero.

Os coeficientes oficiais devem ser copiados da composicao SINAPI/ORSE conferida.

## Validacoes

O importador rejeita:

- `coefficient = 0`.
- coeficiente negativo ou ausente.
- fonte diferente de SINAPI/ORSE.
- UF ausente.
- mes de referencia ausente.
- codigo/descricao de composicao ausente.
- codigo/nome/unidade de insumo ausente.
- placeholders como `PREENCHER`, `CODIGO_OFICIAL` ou `YYYY-MM`.
- arquivos marcados como `TEST ONLY`, `MOCK`, `template` ou `example`.

Nao invente coeficientes. Se um valor oficial nao estiver disponivel, deixe a composicao fora da importacao ate a conferencia da fonte oficial.

## Funcoes disponiveis

- `normalizeOfficialBaseRows(data, options)`: normaliza linhas JSON e converte numeros.
- `validateOfficialBaseImport(data, options)`: valida a base sem cadastrar no catalogo.
- `importOfficialBase(data, options)`: valida e cadastra a base oficial se tudo estiver correto.
- `searchImportedOfficialCompositions(query, options)`: busca somente na base oficial importada.
- `clearImportedOfficialBase()`: limpa a base oficial importada.
- `getImportedOfficialBaseStats()`: retorna totais de composicoes, insumos, fonte, UF e mes.

Uma importacao invalida nao substitui uma base oficial valida que ja esteja carregada.

## Como testar

1. Obtenha uma composicao oficial SINAPI/ORSE fora do Stock AI.
2. Copie somente os dados oficiais para o formato JSON normalizado.
3. Execute `validateOfficialBaseImport(data)`.
4. Corrija todos os erros apontados.
5. Execute `importOfficialBase(data)`.
6. Busque pelo codigo com `searchImportedOfficialCompositions("CODIGO")`.
7. Teste um consumo previsto compatível com o `serviceType`.
8. Confira `getImportedOfficialBaseStats()`.
9. Ao terminar o teste, execute `clearImportedOfficialBase()`.

## Proximos passos

- Ler XLSX/CSV oficial com mapeamento assistido.
- Importar pacotes ZIP oficiais quando o formato estiver definido.
- Expor o importador em interface propria.
- Permitir busca online somente em fase futura, com fonte e referencia verificaveis.
