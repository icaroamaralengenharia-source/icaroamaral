# Plataforma Municipal Integrada

Este documento registra a arquitetura oficial da Plataforma Municipal Integrada para manter a visao do SaaS alinhada durante a evolucao por blocos.

## Modulos

### Almoxarifado

Responsavel por itens, entradas, saidas, saldo e unidades municipais.

Escopo:
- itens de estoque;
- entradas aprovadas;
- saidas operacionais;
- saldo calculado por item e unidade;
- unidades municipais vinculadas a uma prefeitura.

### Sentinela

Responsavel por fiscalizacao, alertas e pendencias.

Escopo planejado:
- observar eventos municipais;
- identificar risco, atraso, divergencia ou pendencia;
- gerar alerta ou pendencia acionavel;
- alimentar a rastreabilidade operacional.

### ELO

Responsavel por consulta, analise e assistencia.

Escopo planejado no fluxo municipal:
- responder perguntas sobre prefeitura, unidade, estoque, documentos e pendencias;
- apoiar analise de eventos e alertas;
- orientar proximas acoes com base no contexto municipal autorizado.

### ObraReport

Responsavel por geracao de relatorios.

Escopo planejado no fluxo municipal:
- transformar analises, fiscalizacoes e evidencias em relatorios;
- gerar documentos oficiais para registro e acompanhamento;
- produzir saidas rastreaveis para o Acervo.

### Acervo

Responsavel por documentos, versoes e download seguro.

Escopo:
- metadados de documentos municipais;
- versoes;
- referencia segura de arquivo;
- download por referencia autorizada;
- arquivamento seguro;
- separacao por prefeitura e unidade.

### Auditoria/Timeline

Responsavel por rastreabilidade.

Escopo:
- registrar eventos relevantes;
- preservar autor, alvo, acao e contexto;
- permitir acompanhamento historico;
- sustentar auditoria operacional e institucional.

## Fluxo Oficial

```text
movimentacao
-> evento
-> analise do Sentinela
-> alerta ou pendencia
-> consulta/analise do ELO
-> relatorio no ObraReport
-> documento no Acervo
-> auditoria e Timeline
```

## Escopo Municipal

O escopo municipal e sempre baseado em prefeitura e unidade.

Regras:
- `institution_id` representa a prefeitura;
- `unit_id` representa o almoxarifado;
- nunca usar `project_id` nesse fluxo;
- nunca misturar tenants;
- toda listagem, detalhe, criacao, versao, download, movimentacao e auditoria deve respeitar `institution_id`;
- quando houver unidade, o `unit_id` deve pertencer ao mesmo `institution_id`;
- gestor acessa somente unidades autorizadas;
- leitura acessa somente leitura;
- o backend e sempre a fonte final de autorizacao.

## Estado Atual

Pronto e comprovado:
- administracao multi-tenant;
- superadmin;
- gestor;
- funcionario;
- almoxarifado;
- estoque real;
- prateleira;
- auditoria;
- Acervo Municipal;
- homologacao E2E ja comprovada.

## Proximas Etapas

Prioridades planejadas:
- Sentinela Municipal;
- ferramentas municipais do ELO;
- ObraReport Municipal;
- ponte ObraReport -> Acervo;
- painel unico;
- homologacao visual.

## Regras Permanentes

Regras de trabalho:
- um bloco por vez;
- comandos curtos;
- travas fortes;
- testes antes do commit;
- sem push antes da homologacao;
- nenhum modulo "so funcionando": precisa estar seguro, bonito, rapido e responsivo.
