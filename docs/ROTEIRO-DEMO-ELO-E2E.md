# Roteiro Demo ELO E2E

Este roteiro e para uma demonstracao controlada de ate 10 minutos no ambiente ELO E2E TEST. Nao e producao, nao usa dados reais e nao deve ser apresentado como ambiente definitivo.

## Ambiente autorizado

- Projeto Supabase autorizado: `mplpzyalcxhhinuvjthx`
- Projeto proibido: nao usar `lidueokjpzxdybtongbk`
- Instituicao demonstrativa: `HOMOLOGACAO_PREFEITURA_E2E`
- Unidade principal: `ALMOXARIFADO_CENTRAL_E2E`
- Usuarios ficticios: `gestor@elo-e2e.test` e `leitura@elo-e2e.test`
- WhatsApp/e-mail: desligados para demonstracao

## Sequencia de 10 minutos

### 0:00 - 1:00 Login

Entrar em aba anonima ou navegador limpo usando somente usuario ficticio do E2E. Confirmar visualmente que nao ha conta pessoal conectada, extensoes de senha abertas ou dados reais preenchidos automaticamente.

Mensagem de abertura: "Esta e uma demonstracao controlada no ambiente E2E homologado, com dados ficticios e sem envio externo."

### 1:00 - 2:00 Visao Geral

Abrir a Visao Geral e mostrar o painel operacional como ponto de partida. Destacar que os indicadores sao de homologacao e servem para validar fluxo, isolamento e navegacao.

Nao comentar numeros como metricas reais de operacao.

### 2:00 - 3:00 Almoxarifado

Mostrar itens ficticios de estoque, como cimento, blocos ou itens E2E, quando disponiveis no tenant de teste. Usar a tela apenas para leitura, filtros e consulta.

Nao criar entrada, saida, ajuste ou baixa durante a apresentacao.

### 3:00 - 4:00 Patrimonio

Abrir Patrimonio e mostrar bens com prefixos de homologacao, como `HOMOLOGACAO_FUNCIONAL_43_*`. Demonstrar busca por tombamento mascarado, status e unidade vinculada.

Nao transferir, editar, baixar ou criar patrimonio.

### 4:00 - 5:00 Sentinela

Mostrar alertas e leituras operacionais do Sentinela. Explicar que o Sentinela identifica inconsistencias e riscos em dados de teste, preservando isolamento por instituicao/unidade.

Nao resolver alerta, nao executar scan de escrita e nao disparar automacoes externas.

### 5:00 - 6:00 Notificacoes

Abrir Notificacoes e mostrar notificacoes `in_app` existentes. Se aparecerem registros de e-mail/WhatsApp, usar apenas para demonstrar que estao com status de falha controlada por canal desligado.

Nao enviar mensagem externa e nao marcar a demonstracao como comunicacao real.

### 6:00 - 7:00 Relatorios e Acervo

Abrir Relatorios e Acervo para mostrar documento ficticio, como `RELATORIO_HOMOLOGACAO_E2E`, e a ideia de historico/versionamento.

Nao gerar relatorio novo, nao baixar arquivo com dados sensiveis e nao alterar acervo.

### 7:00 - 8:30 ELO

Abrir o ELO em contexto municipal e fazer uma consulta segura de leitura, por exemplo:

```text
Mostre um resumo dos dados ficticios disponiveis nesta homologacao, sem criar, alterar ou excluir nada.
```

Se citar patrimonio, notificacoes ou documentos, manter a conversa em termos de homologacao e dados ficticios.

### 8:30 - 9:30 Consulta offline

Demonstrar a consulta offline/local somente como capacidade de continuidade operacional. Usar registros ficticios ja presentes no navegador limpo ou fixture local, sem sincronizar nem enviar lote.

Nao executar sincronizacao real durante a apresentacao.

### 9:30 - 10:00 Encerramento

Reforcar tres pontos: ambiente E2E isolado, dados ficticios, sem envio externo. Fechar com proximos passos de validacao assistida, sem prometer disponibilidade de producao.

## Evidencias da auditoria

- Branch auditada: `main`
- HEAD auditado: `a001832`
- Git status inicial auditado: limpo
- Ambiente `.env.e2e`: valido pelo script local `scripts/e2e/validate-e2e-env.mjs`
- Projeto lido na auditoria segura: `mplpzyalcxhhinuvjthx`
- Projeto proibido detectado na auditoria segura: nao utilizado
- Instituicao E2E: encontrada
- Unidade: encontrada
- Gestor: encontrado
- Usuario leitura: encontrado
- Patrimonio ficticio: encontrado
- Documento ficticio: encontrado
- Notificacoes `in_app`: encontradas
- WhatsApp/e-mail: desligados por configuracao de fixture e registros de falha controlada

## Ressalvas

- Existe alteracao pendente fora desta entrega em `noticias/noticias.css`; nao foi restaurada.
- Na leitura segura, o estoque ficticio apareceu no tenant base E2E de estoque, enquanto a instituicao municipal homologada retornou patrimonio, documentos e notificacoes. Para uma demo totalmente linear, confirme na interface qual tela de almoxarifado sera aberta antes de apresentar.
- A auditoria mascarada identificou documento placeholder `00.000.000/0000-00`; ele e ficticio, mas qualquer validador automatico pode marca-lo como padrao de CNPJ.
