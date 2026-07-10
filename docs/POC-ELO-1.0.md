# PROTOCOLO DE OPERAÇÃO DE CÓDIGO — POC 1.0
## Projeto ELO Core

## Camada 0 — Decisão

Antes de qualquer implementação, avaliar:

- resolve problema real?
- já existe algo equivalente?
- é prioridade?
- reduz ou aumenta complexidade?
- pode ser adiado?

## Camada 1 — Comportamento

Antes de escrever código, definir:

- objetivo;
- input do usuário;
- saída esperada;
- saídas proibidas;
- critério de aceite.

Formato obrigatório:

```text
Input do usuário -> Saída esperada
```

Não escrever código antes da aprovação da Camada 1.

## Camada 2 — Arquitetura e Implementação

Após aprovação da Camada 1, informar:

- objetivo técnico;
- arquivos afetados;
- arquivos novos;
- fora de escopo;
- estratégia;
- testes;
- critério de aceite;
- critério de não regressão;
- risco;
- rollback.

## Regra de responsabilidade única

Cada tarefa deve tratar apenas uma responsabilidade.

Exemplos permitidos:

- interface;
- histórico;
- memória;
- classificador;
- roteador;
- execução direta;
- ferramenta;
- persistência;
- segurança;
- escalabilidade.

Exemplos proibidos:

- interface + backend;
- memória + layout;
- segurança + CADISTA;
- chat + orçamento + PDF.

Se o pedido misturar responsabilidades:

- interromper;
- dividir em etapas;
- executar apenas uma por vez.

## Ordem oficial de evolução

1. Interface
2. Histórico
3. Memória
4. Classificador
5. Roteador
6. Execução direta
7. Ferramentas
8. Persistência definitiva
9. Segurança
10. Escalabilidade

## Critério de não regressão

Toda tarefa deve listar o que não pode quebrar.

Exemplos:

- chat;
- gate;
- PDF;
- CADISTA;
- Stock;
- RDO;
- orçamento;
- memória;
- mobile.

## Risco e rollback

Toda implementação deve declarar:

- risco: baixo, médio ou alto;
- motivo;
- arquivos afetados;
- como reverter.

## Regra final de execução

Depois que comportamento, escopo e critério de aceite estiverem claros:

- não pedir nova confirmação desnecessária;
- entregar imediatamente o código ou prompt de implementação;
- não encerrar apenas com conclusão teórica.

## Checklist final obrigatório

Antes de finalizar qualquer tarefa, responder:

- comportamento implementado?
- critério de aceite atendido?
- responsabilidade extra adicionada?
- arquivo fora do escopo?
- regressão conhecida?
- risco?
- rollback?
