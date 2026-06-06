# Stock AI Obras - Interface de upload da base oficial

Este guia documenta a Fase 2.0D: a interface simples de upload local para bases oficiais SINAPI/ORSE no `stock-ai-obras.html`.

## Objetivo

Permitir que o usuario valide e importe uma base oficial local sem inventar coeficientes, sem baixar arquivos da internet e sem substituir o catalogo demonstrativo/fallback.

## Como importar CSV

1. Abra `stock-ai-obras.html`.
2. Na area **Importar base oficial SINAPI/ORSE**, selecione a fonte `SINAPI` ou `ORSE`.
3. Informe a UF.
4. Informe o mes de referencia.
5. Selecione um arquivo `.csv`.
6. Clique em **Validar arquivo**.
7. Corrija qualquer erro apresentado.
8. Clique em **Importar base**.

Depois da importacao, a base oficial importada passa a ter prioridade sobre a base demonstrativa. A base demonstrativa continua disponivel como fallback.

## Como importar XLSX

A interface aceita arquivos `.xlsx` e carrega `relatorio-qualidade-obras/xlsx.full.min.js` para disponibilizar `window.XLSX` no navegador.

Se a biblioteca XLSX nao estiver disponivel ou falhar ao carregar, a interface exibe um fallback seguro e nao quebra a pagina:

```text
Nao foi possivel ler o XLSX.
Verifique se a biblioteca XLSX esta carregada.
Use CSV nesta fase ou importe XLSX pelo fluxo backend/testes.
```

## Fallback XLSX no browser

Nesta fase:

- CSV funciona diretamente no navegador.
- XLSX funciona diretamente no navegador quando `window.XLSX` carrega corretamente.
- O adaptador SINAPI Analitico e tentado antes do leitor XLSX generico.
- Nenhum bundler novo foi adicionado.

## Campos obrigatorios

- Fonte: `SINAPI` ou `ORSE`.
- UF: exemplo `BA`.
- Mes de referencia: formato `AAAA-MM`.
- Arquivo: CSV ou XLSX obtido de fonte oficial.

## ColumnMap

O textarea **ColumnMap avancado** aceita JSON opcional para mapear colunas com nomes diferentes:

```json
{
  "compositionCode": "COD_COMP",
  "compositionName": "DESC_COMP",
  "compositionUnit": "UN_COMP",
  "inputCode": "COD_INSUMO",
  "inputName": "DESC_INSUMO",
  "inputUnit": "UN_INSUMO",
  "coefficient": "COEF"
}
```

Se o JSON for invalido, a interface mostra erro claro e nao valida nem importa.

## Validacao antes da importacao

O botao **Validar arquivo** executa a leitura e a validacao sem cadastrar a base.

A area de resultado mostra:

- status;
- erros;
- avisos;
- total de linhas;
- total de composicoes;
- total de insumos;
- fonte;
- UF;
- mes;
- exemplos das primeiras composicoes detectadas.

## Importacao

O botao **Importar base** executa a leitura, valida os dados e cadastra a base oficial se tudo estiver correto.

O motor continua rejeitando:

- coeficiente ausente, zero ou negativo;
- placeholders;
- templates;
- examples;
- mocks;
- TEST ONLY.

## Limpar base

O botao **Limpar base importada** chama `clearImportedOfficialBase()` e restaura o uso do catalogo demonstrativo/fallback.

Mensagem esperada:

```text
Base oficial importada removida. O Stock AI voltou ao catalogo demonstrativo/fallback.
```

## Limitacoes

- Nao baixa arquivo da internet.
- Nao cria crawler.
- Nao inventa coeficientes.
- Nao persiste a base importada apos recarregar a pagina.
- XLSX direto no navegador depende de `window.XLSX`.

## Proximos passos

- Persistencia controlada da base importada.
- Fluxo backend para importacao oficial.
- Importacao ZIP.
- Busca online oficial controlada, com fonte e referencia verificaveis.
