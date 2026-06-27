# Registro de Validacao de Campo V1.0 - Stock Full

Documento para registrar a validacao pratica da V1.0 do Stock Full em dois celulares reais, seguindo o checklist oficial publicado em `docs/stock-full-checklist-v1.md`.

## Dados Antes do Teste

| Campo | Valor |
|---|---|
| URL publicada usada nos dois celulares | |
| Data do teste | |
| Celular 1 | Patrao/Admin |
| Celular 2 | Funcionario/Operador |
| Empresa/companyId | |
| Login usado no celular 1 | |
| Login usado no celular 2 | |
| Produto novo usado no teste | Produto Teste Dois Celulares 2026-06-26 |
| Saldo inicial | |

## Regras do Teste

- Nao misturar com testes antigos.
- Tirar print ou gravar tela nos pontos criticos.
- Registrar resultado obtido em todas as fases.
- Marcar como REPROVADO qualquer criterio critico que falhar.
- Nao iniciar evolucao V1.1 antes de concluir esta validacao.

## Pontos Criticos Para Print/Video

- Permissao bloqueada.
- Modo offline.
- Fila pendente.
- Sincronizacao concluida.
- Saldo final.
- Auditoria.
- Teste de resistencia com saldo esperado e saldo obtido.

## Tabela de Registro

| ID | Fase | Cenario | Celular | Perfil | Empresa | Acao executada | Resultado esperado | Resultado obtido | Status | Observacoes | Print/video | Data/hora |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 01 | Login Admin | Admin acessa o Stock Full | Celular 1 | Admin/Patrao | Empresa A | Fazer login | Admin entra e ve dashboard completo | | | | | |
| 02 | Login Funcionario | Funcionario acessa o Stock Full | Celular 2 | Funcionario/Operador | Empresa A | Fazer login | Funcionario entra e ve apenas funcoes permitidas | | | | | |
| 03 | Permissoes Admin | Conferir funcoes administrativas | Celular 1 | Admin/Patrao | Empresa A | Verificar botoes e menus | Admin ve cadastrar produto, importar CSV, exportar backup, auditoria e configuracoes | | | | | |
| 04 | Permissoes Funcionario | Conferir bloqueios do funcionario | Celular 2 | Funcionario/Operador | Empresa A | Tentar acessar funcoes proibidas | Funcionario nao acessa importar CSV, exportar backup, auditoria completa, configuracoes nem administracao | | | | | |
| 05 | Cadastro pelo Admin | Criar produto novo | Celular 1 | Admin/Patrao | Empresa A | Cadastrar Produto Teste Dois Celulares 2026-06-26 | Produto criado na empresa correta | | | | | |
| 06 | Produto no Funcionario | Ver produto no segundo celular | Celular 2 | Funcionario/Operador | Empresa A | Atualizar ou reabrir app | Funcionario ve o produto da mesma empresa | | | | | |
| 07 | Entrada de Estoque | Registrar entrada | Celular 2 | Funcionario/Operador | Empresa A | Entrada de 10 unidades | Entrada aumenta saldo corretamente | | | | | |
| 08 | Saida de Estoque | Registrar saida | Celular 2 | Funcionario/Operador | Empresa A | Saida de 3 unidades | Saida reduz saldo corretamente | | | | | |
| 09 | Bloqueio de Saldo Negativo | Tentar saida maior que saldo | Celular 2 | Funcionario/Operador | Empresa A | Saida de 999 unidades | Saida de 999 unidades e bloqueada | | | | | |
| 10 | Offline no Funcionario | Desligar internet | Celular 2 | Funcionario/Operador | Empresa A | Abrir ou continuar uso offline | App mostra "Modo offline - alteracoes serao sincronizadas quando a internet voltar." | | | | | |
| 11 | Operacao Offline Pendente | Criar movimento offline | Celular 2 | Funcionario/Operador | Empresa A | Registrar entrada ou saida offline | Entrada ou saida offline fica salva na fila local | | | | | |
| 12 | Sincronizacao | Voltar internet | Celular 2 | Funcionario/Operador | Empresa A | ReligAR internet e aguardar sync | Fila sincroniza sem duplicar | | | | | |
| 13 | Conferencia no Admin | Conferir saldo apos sync | Celular 1 | Admin/Patrao | Empresa A | Atualizar app e conferir produto | Admin ve saldo atualizado apos sync | | | | | |
| 14 | Concorrencia | Operacoes quase simultaneas | Ambos | Admin e Funcionario | Empresa A | Funcionario entrada de 2 e admin saida de 1 quase ao mesmo tempo | Entrada e saida mantem saldo correto | | | | | |
| 15 | Troca de Rede Durante Sync | Alternar Wi-Fi/4G durante sync | Celular 2 | Funcionario/Operador | Empresa A | Trocar rede durante sincronizacao | Sync continua ou retoma sem duplicar | | | | | |
| 16 | Sincronizacao Repetida | Forcar sync duplicada | Celular 2 | Funcionario/Operador | Empresa A | Sincronizar a mesma operacao duas vezes | Mesma operacao nao e aplicada duas vezes | | | | | |
| 17 | Reinicio com Fila Pendente | Reiniciar antes da sync | Celular 2 | Funcionario/Operador | Empresa A | Criar movimentacao offline e reiniciar aparelho | Fila nao some apos reiniciar celular | | | | | |
| 18 | Auditoria | Conferir registros de movimentacao | Celular 1 | Admin/Patrao | Empresa A | Abrir auditoria/historico | Movimentacoes registram usuario, empresa, data, hora, tipo, quantidade e dispositivo, se disponivel | | | | | |
| 19 | Mobile | Validar uso vertical | Ambos | Admin e Funcionario | Empresa A | Navegar pelos fluxos principais | Sem botao cortado, sem rolagem horizontal critica, campos legiveis | | | | | |
| 20 | Teste de Resistencia | Simular uso intenso | Ambos | Admin e Funcionario | Empresa A | Simular aproximadamente 100 movimentacoes entre entradas e saidas, alternando online/offline | Saldo final bate exatamente com saldo esperado | | | | | |

## Criterio de Reprovacao

Marcar como REPROVADO se ocorrer qualquer um destes:

- saldo negativo;
- duplicidade;
- perda de movimentacao;
- funcionario acessando funcao proibida;
- empresa A vendo dado de outra empresa;
- fila offline sumindo;
- sync aplicando operacao duas vezes;
- saldo final divergente no teste de resistencia.

## Criterio de Aprovacao

So considerar Stock Full V1.0 Estavel se:

- todos os testes criticos passarem;
- admin e funcionario usarem a mesma empresa corretamente;
- permissoes estiverem corretas;
- offline/sync funcionar;
- saldo nunca ficar negativo;
- auditoria registrar operacoes;
- mobile estiver utilizavel;
- teste de resistencia com 100 movimentacoes bater saldo final.

## Resultado Final

| Campo | Valor |
|---|---|
| Status geral | |
| Responsavel pelo teste | |
| Data/hora de conclusao | |
| Saldo esperado final | |
| Saldo obtido final | |
| Quantidade de testes aprovados | |
| Quantidade de testes reprovados | |
| Decisao | |
| Observacoes finais | |
