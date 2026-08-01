# Demo Municipal

## Objetivo

Demonstrar a plataforma municipal em 15 a 20 minutos, usando apenas ambiente de demonstracao ou E2E/homologacao, com dados ficticios, sem expor credenciais, tokens, IDs reais, chaves Supabase ou informacoes pessoais de usuarios reais.

## Preparacao

- Abrir o painel municipal em dominio de demonstracao.
- Confirmar que WhatsApp e e-mail externos estao desativados.
- Confirmar que o banco usado e demonstracao ou E2E/homologacao, nunca producao.
- Usar usuario de demonstracao previamente criado pelo responsavel tecnico.
- Deixar o plano B offline validado: tela de patrimonio ja sincronizada, cache local preparado e roteiro impresso.

## Roteiro De 15 A 20 Minutos

### 1. Abertura E Login (2 min)

- Explicar que a demonstracao cobre administracao municipal, almoxarifado, patrimonio, alertas, documentos e ELO Municipal.
- Entrar com usuario demonstrativo.
- Mostrar a sessao, papel do usuario, unidade autorizada e status online.
- Reforcar que credenciais reais nao devem ser exibidas.

### 2. Visao Geral (2 min)

- Mostrar indicadores de almoxarifados, itens, alertas, notificacoes, patrimonio e manutencoes.
- Explicar que os cards servem para triagem rapida da gestao.
- Abrir um atalho rapido para evidenciar navegacao entre modulos.

### 3. Almoxarifado (2 min)

- Abrir Prateleira Operacional.
- Mostrar unidade, itens, saldo, baixo estoque, zerados e ultimas movimentacoes.
- Explicar que o gestor visualiza apenas unidades autorizadas.

### 4. Patrimonio (3 min)

- Abrir Patrimonio.
- Buscar bem por tombamento ficticio.
- Mostrar detalhe, conservacao, localizacao, responsavel e historico.
- Demonstrar, se o perfil permitir, fluxo de transferencia, manutencao e baixa sem executar acao irreversivel em producao.

### 5. Sentinela (2 min)

- Abrir Sentinela.
- Mostrar alertas por severidade e status.
- Explicar exemplos: item zerado, estoque abaixo do minimo, bem em mau estado, documento pendente.
- Reforcar que o alerta orienta acao, mas nao altera estoque/patrimonio sozinho.

### 6. Notificacoes (2 min)

- Abrir Notificacoes.
- Mostrar notificacoes in-app, status pendente/lida e contador.
- Explicar que e-mail e WhatsApp permanecem desativados na demonstracao.

### 7. Relatorios E Acervo (3 min)

- Abrir Relatorios.
- Mostrar preview ou geracao controlada de relatorio demonstrativo.
- Abrir Acervo e mostrar documento, versao, unidade e referencia segura.
- Explicar que `storage_path`, caminho privado e dados sensiveis nao aparecem no painel.

### 8. ELO Municipal (2 min)

- Abrir Assistente ELO.
- Fazer pergunta segura: "Quais bens precisam de atencao nesta unidade?"
- Mostrar resposta baseada no contexto municipal autorizado.
- Explicar que o ELO respeita escopo de instituicao, unidade e papel.

### 9. Consulta Offline (2 min)

- Informar que a consulta offline e somente leitura.
- Simular indisponibilidade de internet apenas se o ambiente permitir.
- Buscar bem por tombamento ja sincronizado.
- Mostrar mensagem de dados sincronizados e bloqueio de escrita offline.

### 10. Encerramento Comercial (2 min)

- Recapitular ganhos: visao unificada, rastreabilidade, alertas, patrimonio, documentos e assistente.
- Alinhar proximos passos: treinamento, carga controlada de dados, dominio, aceite e cronograma de producao.
- Registrar duvidas do cliente sem prometer ativacao de integracoes externas antes de homologacao.

## Dados Que Nao Devem Ser Exibidos

- Senhas, tokens, JWT, cookies ou chaves.
- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` ou qualquer segredo de backend.
- IDs completos de usuarios reais.
- E-mails ou telefones reais.
- Caminhos privados de storage.
- Logs brutos de erro.
- Dados de producao.
- Projeto E2E como fallback operacional de producao.

## Plano B Caso A Internet Falhe

- Manter o painel de Patrimonio aberto antes da reuniao.
- Sincronizar bens ficticios previamente.
- Usar a busca offline por tombamento.
- Demonstrar que escrita offline fica bloqueada.
- Apresentar prints ou roteiro PDF do restante do fluxo.
- Agendar validacao online complementar se a falha impedir relatorios, acervo ou ELO.

## Encerramento Seguro

- Fazer logout.
- Fechar abas compartilhadas.
- Nao enviar credenciais por chat.
- Registrar pendencias em ata, sem anexar segredos ou prints com tokens.
