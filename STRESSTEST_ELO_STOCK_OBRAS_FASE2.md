# STRESSTEST ELO + STOCK OBRAS + SINAPI - FASE 2A

## 1. Resumo executivo
- Nota anterior registrada: 7,6/10.
- Cenarios aprovados antes: 3/10.
- Nota apos correcao de roteamento: 10/10.
- Cenarios aprovados apos correcao: 10/10.
- Objetivo desta rodada: confirmar que perguntas de obras/orcamento/SINAPI nao caem mais no fallback generico/reflexivo/RDO.

## 2. Tabela geral
| No | Cenario | Status | Nota |
|---:|---|---|---:|
| 1 | Sem base oficial | Passou | 10/10 |
| 2 | Com base SINAPI importada | Passou | 10/10 |
| 3 | Com porta e janela | Passou | 10/10 |
| 4 | Bloco nao pode virar parede | Passou | 10/10 |
| 5 | Base demonstrativa deve ser bloqueada | Passou | 10/10 |
| 6 | Dados insuficientes | Passou | 10/10 |
| 7 | Produtividade/mao de obra | Passou | 10/10 |
| 8 | Orcamento sem precos | Passou | 10/10 |
| 9 | UF/mes | Passou | 10/10 |
| 10 | Pergunta bonus | Passou | 10/10 |

## 3. Respostas completas por cenario
### 1. Sem base oficial

**Pergunta**
```txt
Quantos blocos 14x19x29 preciso para uma parede de 20 m por 2,80 m?
```

**Resposta gerada pelo sistema**
```txt
Já registrei:
- Comprimento da parede: 20,00 m
- Altura da parede: 2,80 m
- Área bruta: 56,00 m²
Ainda preciso confirmar:
- se existem vãos. A parede terá portas ou janelas? Se sim, informe quantidade e medidas. Ex.: 1 porta de 0,80 x 2,10 m; 2 janelas de 1,20 x 1,00 m. Ou confirme: parede íntegra, sem vãos
- perda adotada em porcentagem, por exemplo 8% ou 10%
- se haverá revestimento em um lado, nos dois lados ou sem revestimento
Depois vou verificar SINAPI/ORSE ou composição interna validada.
```

**Esperado:** Coletar premissas antes de bloquear.
**Status:** Passou
**Nota:** 10/10
**Problemas:** nenhum critico neste cenario.

### 2. Com base SINAPI importada

**Pergunta**
```txt
Parede 20 x 2,80 com premissas completas
```

**Resposta gerada pelo sistema**
```txt
Briefing técnico consolidado; composição oficial localizada.
Base técnica utilizada: SINAPI | código SINAPI-ALV-ELO | unidade m2 | BA | referência 2026-06
Composição localizada:
- Código: SINAPI-ALV-ELO
- Descrição: Alvenaria de vedacao com bloco ceramico 14x19x29 cm
- Unidade: m2
- Fonte: SINAPI
- UF/mês: BA / 2026-06
Premissas utilizadas:
- Comprimento da parede: 20,00 m
- Altura da parede: 2,80 m
- Área bruta: 56,00 m²
- Vãos descontados: nenhum
- Área total de vãos: não calculada
- Área líquida considerada: 56,00 m²
- Bloco considerado: 14x19x29
- Perda adotada: 0%
- Lados revestidos: sem revestimento
Memória de cálculo:
- Área líquida 56,00 m² x coeficientes oficiais da composição SINAPI-ALV-ELO.
Consumo calculado pelo motor Stock Obras:
- Argamassa de assentamento oficial: 0,672 m³
- Bloco ceramico 14x19x29 cm: 756 un
- Pedreiro oficial: 34,72 h
- Servente oficial: 17,36 h
```

**Esperado:** Encontrar SINAPI e calcular consumo.
**Status:** Passou
**Nota:** 10/10
**Problemas:** nenhum critico neste cenario.

### 3. Com porta e janela

**Pergunta**
```txt
Parede 12 x 2,80 com porta e duas janelas
```

**Resposta gerada pelo sistema**
```txt
Briefing técnico consolidado; composição oficial localizada.
Base técnica utilizada: SINAPI | código SINAPI-ALV-ELO | unidade m2 | BA | referência 2026-06
Composição localizada:
- Código: SINAPI-ALV-ELO
- Descrição: Alvenaria de vedacao com bloco ceramico 14x19x29 cm
- Unidade: m2
- Fonte: SINAPI
- UF/mês: BA / 2026-06
Premissas utilizadas:
- Comprimento da parede: 12,00 m
- Altura da parede: 2,80 m
- Área bruta: 33,60 m²
- Vãos descontados: 1 porta 0,90 x 2,10 m = 1,89 m²; 2 janelas 1,20 x 1,00 m = 2,40 m²
- Área total de vãos: 4,29 m²
- Área líquida considerada: 29,31 m²
- Bloco considerado: 14x19x29
- Perda adotada: 0%
- Lados revestidos: sem revestimento
Memória de cálculo:
- Área líquida 29,31 m² x coeficientes oficiais da composição SINAPI-ALV-ELO.
Consumo calculado pelo motor Stock Obras:
- Argamassa de assentamento oficial: 0,352 m³
- Bloco ceramico 14x19x29 cm: 395,685 un
- Pedreiro oficial: 18,172 h
- Servente oficial: 9,086 h
```

**Esperado:** Descontar vaos e calcular pela composicao real.
**Status:** Passou
**Nota:** 10/10
**Problemas:** nenhum critico neste cenario.

### 4. Bloco nao pode virar parede

**Pergunta**
```txt
Bloco 14x19x29 no texto
```

**Resposta gerada pelo sistema**
```txt
Já registrei:
- Comprimento da parede: 20,00 m
- Altura da parede: 2,80 m
- Área bruta: 56,00 m²
Ainda preciso confirmar:
- se existem vãos. A parede terá portas ou janelas? Se sim, informe quantidade e medidas. Ex.: 1 porta de 0,80 x 2,10 m; 2 janelas de 1,20 x 1,00 m. Ou confirme: parede íntegra, sem vãos
- perda adotada em porcentagem, por exemplo 8% ou 10%
- se haverá revestimento em um lado, nos dois lados ou sem revestimento
Depois vou verificar SINAPI/ORSE ou composição interna validada.
```

**Esperado:** Nao interpretar 14x19 como geometria da parede.
**Status:** Passou
**Nota:** 10/10
**Problemas:** nenhum critico neste cenario.

### 5. Base demonstrativa deve ser bloqueada

**Pergunta**
```txt
Parede completa sem base oficial
```

**Resposta gerada pelo sistema**
```txt
Briefing técnico consolidado, mas ainda preciso de uma composição SINAPI/ORSE ou interna validada para calcular consumo, mão de obra, produtividade ou custo com segurança.
Base técnica utilizada: não localizada
Premissas utilizadas:
- Comprimento da parede: 20,00 m
- Altura da parede: 2,80 m
- Área bruta: 56,00 m²
- Vãos descontados: nenhum
- Área total de vãos: não calculada
- Área líquida considerada: 56,00 m²
- Bloco considerado: 14x19x29
- Perda adotada: 10%
- Lados revestidos: dois lados
Não vou gerar quantitativo, consumo, mão de obra, produtividade ou valor oficial sem base técnica.
Você pode informar o código/composição SINAPI/ORSE ou autorizar explicitamente uma estimativa preliminar NÃO OFICIAL.
```

**Esperado:** Bloquear sem base real.
**Status:** Passou
**Nota:** 10/10
**Problemas:** nenhum critico neste cenario.

### 6. Dados insuficientes

**Pergunta**
```txt
Quero fazer alvenaria de bloco baiano
```

**Resposta gerada pelo sistema**
```txt
Já registrei:
- Comprimento da parede: não informado
- Altura da parede: não informado
- Área bruta: não calculada
Ainda preciso confirmar:
- comprimento e altura, ou área bruta da parede
- dimensão real do bloco. Qual a dimensão do bloco? Ex.: 14x19x39, 14x19x29 ou outra medida real do bloco cerâmico
- se existem vãos. A parede terá portas ou janelas? Se sim, informe quantidade e medidas. Ex.: 1 porta de 0,80 x 2,10 m; 2 janelas de 1,20 x 1,00 m. Ou confirme: parede íntegra, sem vãos
- perda adotada em porcentagem, por exemplo 8% ou 10%
- se haverá revestimento em um lado, nos dois lados ou sem revestimento
Depois vou verificar SINAPI/ORSE ou composição interna validada.
```

**Esperado:** Perguntar dados faltantes.
**Status:** Passou
**Nota:** 10/10
**Problemas:** nenhum critico neste cenario.

### 7. Produtividade/mao de obra

**Pergunta**
```txt
Homens-hora para 100 m2 de alvenaria
```

**Resposta gerada pelo sistema**
```txt
Briefing técnico consolidado; composição oficial localizada.
Base técnica utilizada: SINAPI | código SINAPI-ALV-ELO | unidade m2 | BA | referência 2026-06
Composição localizada:
- Código: SINAPI-ALV-ELO
- Descrição: Alvenaria de vedacao com bloco ceramico 14x19x29 cm
- Unidade: m2
- Fonte: SINAPI
- UF/mês: BA / 2026-06
Premissas utilizadas:
- Comprimento da parede: não informado
- Altura da parede: não informado
- Área bruta: 100,00 m²
- Vãos descontados: nenhum
- Área total de vãos: não calculada
- Área líquida considerada: 100,00 m²
- Bloco considerado: 14x19x29
- Perda adotada: 0%
- Lados revestidos: sem revestimento
Memória de cálculo:
- Área líquida 100,00 m² x coeficientes oficiais da composição SINAPI-ALV-ELO.
Consumo calculado pelo motor Stock Obras:
- Argamassa de assentamento oficial: 1,2 m³
- Bloco ceramico 14x19x29 cm: 1350 un
- Pedreiro oficial: 62 h
- Servente oficial: 31 h
```

**Esperado:** Roteamento tecnico e composicao se possivel.
**Status:** Passou
**Nota:** 10/10
**Problemas:** nenhum critico neste cenario.

### 8. Orcamento sem precos

**Pergunta**
```txt
Custo total de parede 100 m2
```

**Resposta gerada pelo sistema**
```txt
Briefing técnico consolidado; composição oficial localizada.
Base técnica utilizada: SINAPI | código SINAPI-ALV-ELO | unidade m2 | BA | referência 2026-06
Composição localizada:
- Código: SINAPI-ALV-ELO
- Descrição: Alvenaria de vedacao com bloco ceramico 14x19x29 cm
- Unidade: m2
- Fonte: SINAPI
- UF/mês: BA / 2026-06
Premissas utilizadas:
- Comprimento da parede: não informado
- Altura da parede: não informado
- Área bruta: 100,00 m²
- Vãos descontados: nenhum
- Área total de vãos: não calculada
- Área líquida considerada: 100,00 m²
- Bloco considerado: 14x19x29
- Perda adotada: 0%
- Lados revestidos: sem revestimento
Memória de cálculo:
- Área líquida 100,00 m² x coeficientes oficiais da composição SINAPI-ALV-ELO.
Consumo calculado pelo motor Stock Obras:
- Argamassa de assentamento oficial: 1,2 m³
- Bloco ceramico 14x19x29 cm: 1350 un
- Pedreiro oficial: 62 h
- Servente oficial: 31 h
```

**Esperado:** Nao inventar preco.
**Status:** Passou
**Nota:** 10/10
**Problemas:** nenhum critico neste cenario.

### 9. UF/mes

**Pergunta**
```txt
SINAPI Bahia junho 2026 para 40 m2 alvenaria
```

**Resposta gerada pelo sistema**
```txt
Briefing técnico consolidado; composição oficial localizada.
Base técnica utilizada: SINAPI | código SINAPI-ALV-ELO | unidade m2 | BA | referência 2026-06
Composição localizada:
- Código: SINAPI-ALV-ELO
- Descrição: Alvenaria de vedacao com bloco ceramico 14x19x29 cm
- Unidade: m2
- Fonte: SINAPI
- UF/mês: BA / 2026-06
Premissas utilizadas:
- Comprimento da parede: não informado
- Altura da parede: não informado
- Área bruta: 40,00 m²
- Vãos descontados: nenhum
- Área total de vãos: não calculada
- Área líquida considerada: 40,00 m²
- Bloco considerado: 14x19x29
- Perda adotada: 0%
- Lados revestidos: sem revestimento
Memória de cálculo:
- Área líquida 40,00 m² x coeficientes oficiais da composição SINAPI-ALV-ELO.
Consumo calculado pelo motor Stock Obras:
- Argamassa de assentamento oficial: 0,48 m³
- Bloco ceramico 14x19x29 cm: 540 un
- Pedreiro oficial: 24,8 h
- Servente oficial: 12,4 h
```

**Esperado:** Citar fonte, UF e mes.
**Status:** Passou
**Nota:** 10/10
**Problemas:** nenhum critico neste cenario.

### 10. Pergunta bonus

**Pergunta**
```txt
Residencia 120 m2 com quantitativos, SINAPI, equipe e riscos
```

**Resposta gerada pelo sistema**
```txt
Entendi que é uma pergunta técnica de obras sobre residência/obra completa.

Para responder com segurança, preciso consolidar premissas e localizar uma base técnica SINAPI/ORSE ou composição interna validada.

Dados mínimos úteis:
- serviço desejado e unidade de medição;
- área, comprimento x altura, volume ou quantidade;
- tipo/dimensão do material principal, quando aplicável;
- vãos, perdas, espessuras e lados revestidos, quando aplicável;
- UF e mês de referência da base SINAPI/ORSE;
- preços unitários, se a pergunta envolver custo.

Não vou inventar composição, produtividade, mão de obra, insumos ou valor oficial sem essa base.
```

**Esperado:** Resposta tecnica de limitacao/premissas, nao filosofica.
**Status:** Passou
**Nota:** 10/10
**Problemas:** nenhum critico neste cenario.

## 4. Comparacao com a rodada anterior
- Antes: 7,6/10 e 3/10 cenarios aprovados.
- Depois: 10/10 e 10/10 cenarios aprovados.

## 5. Falhas restantes
- Nenhuma falha critica de roteamento nos cenarios testados.

## 6. Nota final
10/10