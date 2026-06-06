# Stock AI Obras - guia da primeira composicao oficial

## Objetivo

Este guia mostra como transformar uma composicao oficial SINAPI/ORSE em um JSON valido para o Stock AI Obras. O sistema nao cria codigos, nao cria coeficientes e nao substitui a fonte oficial. Ele apenas valida, diagnostica e importa dados preenchidos manualmente.

## Origem dos dados oficiais

Os dados devem vir de uma fonte oficial ou documento tecnico auditavel:

- SINAPI: base oficial de composicoes e insumos usada como referencia para orcamentos de obras.
- ORSE: base de composicoes e insumos usada em orcamentos e servicos de engenharia.
- Composicao oficial: registro do servico, com codigo, descricao, unidade de medicao e lista de insumos.
- Codigo da composicao: identificador oficial do servico na base consultada.
- Descricao: nome tecnico do servico, exatamente como aparece na fonte.
- Unidade: unidade oficial do servico, como `m2`, `m3`, `m`, `un` ou outra informada na base.
- Insumos: materiais, mao de obra ou equipamentos que compoem o servico.
- Coeficientes: quantidades oficiais de cada insumo por unidade do servico.

O Stock AI nao cria esses dados. Se o codigo, a descricao, a unidade, os insumos ou os coeficientes nao estiverem na fonte oficial, a composicao nao deve ser cadastrada como oficial.

## Qual composicao escolher primeiro

Para a primeira validacao, escolha uma composicao pequena, facil de conferir e ligada a uma geometria ja reconhecida pelo Stock AI:

1. Alvenaria de bloco ceramico: boa para testar area de parede e consumo por `m2`.
2. Chapisco: costuma ter poucos insumos e unidade simples.
3. Reboco: permite validar servicos de revestimento por area.
4. Piso ceramico: bom para testar area e materiais de acabamento.
5. Concreto estrutural: util para validar elementos por volume quando a composicao estiver claramente conferida.

Comece com 1 composicao oficial. Depois de validar o fluxo, amplie para 2 a 5 composicoes.

## Tutorial passo a passo

### PASSO 1 - Obter a composicao oficial

Consulte a fonte oficial SINAPI/ORSE ou o documento tecnico institucional usado pela obra. Nao use memoria, chute, resumo informal ou valor digitado de cabeca.

### PASSO 2 - Identificar os dados da composicao

Anote exatamente:

- codigo da composicao;
- descricao oficial;
- unidade oficial;
- referencia consultada;
- UF;
- mes de referencia.

### PASSO 3 - Listar todos os insumos

Copie a lista completa de insumos da composicao oficial. Nao remova item para simplificar o teste, porque isso altera o consumo previsto.

### PASSO 4 - Copiar os dados de cada insumo

Para cada insumo, copie:

- codigo do insumo;
- nome oficial;
- unidade;
- coeficiente oficial.

Todo coeficiente deve ser maior que zero e deve vir da fonte oficial.

### PASSO 5 - Preencher o JSON

Crie o arquivo:

```text
relatorio-qualidade-obras/bases-reais/primeira-composicao-real.json
```

Use `relatorio-qualidade-obras/bases-reais/primeira-composicao-real.example.json` apenas como modelo de estrutura. Nao importe o `.example.json` e nao mantenha placeholders.

### PASSO 6 - Executar diagnostico

Use o assistente:

```text
analyzeOfficialCompositionReadiness(jsonData)
generateOfficialCompositionDiagnosticReport(jsonData)
validateSmallRealCompositionFile(jsonData)
```

O arquivo so esta pronto quando o score for `100`, o diagnostico estiver sem erros e a validacao estrita aprovar.

### PASSO 7 - Importar

Importe o JSON pelo fluxo de catalogo externo controlado. A composicao oficial deve ter prioridade sobre a demonstrativa, mas o catalogo demonstrativo deve continuar disponivel como fallback depois de limpar a importacao.

### PASSO 8 - Testar consumo previsto

Use uma frase compativel com o servico cadastrado. Para alvenaria, por exemplo:

```text
Tenho uma parede de 12 m por 3 m
```

Verifique se a resposta mostra fonte, codigo oficial, UF, mes de referencia, consumo previsto e relatorio tecnico com a composicao importada.

## Exemplo visual com placeholders

Nao preencha os campos abaixo com valores ficticios. Troque cada `PREENCHER` por dado copiado da fonte oficial.

```text
COMPOSICAO OFICIAL

Codigo:
PREENCHER

Descricao:
PREENCHER

Unidade:
PREENCHER

Referencia:
PREENCHER

UF:
PREENCHER

Mes:
PREENCHER

INSUMO

Codigo:
PREENCHER

Nome:
PREENCHER

Unidade:
PREENCHER

Coeficiente:
PREENCHER
```

## Checklist final antes da importacao

- [ ] Codigo preenchido.
- [ ] Descricao preenchida.
- [ ] Unidade preenchida.
- [ ] UF preenchida.
- [ ] Referencia preenchida.
- [ ] Mes preenchido.
- [ ] Todos os insumos preenchidos.
- [ ] Todos os coeficientes sao maiores que zero.
- [ ] Score `100`.
- [ ] Diagnostico sem erros.
- [ ] O arquivo nao e template, example, mock ou TEST ONLY.
- [ ] Os coeficientes vieram da fonte oficial, sem inventar valores.

## Problemas mais comuns

- `coefficient = 0`: o template ainda nao foi preenchido com coeficiente oficial.
- UF ausente: `state` precisa indicar a UF da base oficial.
- Referencia ausente: informe a base, mes e documento consultado.
- Copiar apenas parte dos insumos: a composicao deixa de representar o servico oficial.
- Misturar composicao oficial com dados demonstrativos: invalida a rastreabilidade.
- Usar template/example como oficial: esses arquivos sao apenas modelos e devem continuar invalidos.
- Usar mock de teste: `TEST ONLY` nunca deve entrar como base oficial real.

## Fluxo completo

```text
Composicao oficial
v
JSON preenchido
v
Diagnostico
v
Validacao
v
Importacao
v
Consumo previsto
v
Relatorio tecnico
```

## Criterio de pronto

A primeira composicao oficial so deve ser usada no Stock AI Obras quando:

- vier de fonte SINAPI/ORSE oficial;
- estiver preenchida em `primeira-composicao-real.json`;
- tiver `sourceType = official_manual_entry`;
- tiver `isOfficial = true`;
- tiver todos os insumos e coeficientes oficiais;
- passar no diagnostico e na validacao estrita;
- nao tiver placeholders, mock, example ou template.
