# Checklist Oficial V1.0 - Stock Full

## Objetivo

Validar o Stock Full em cenario real com:

- celular 1 como patrao/admin;
- celular 2 como funcionario/operador;
- mesma empresa;
- uso online;
- uso offline;
- entrada e saida;
- bloqueio de saldo negativo;
- fila de sincronizacao;
- permissoes;
- auditoria.

## Antes de comecar

- Usar a URL publicada do Stock Full nos dois celulares.
- Usar produto novo com nome unico: `Produto Teste Dois Celulares 2026-06-26`.
- Anotar saldo inicial.
- Anotar login/perfil usado em cada celular.
- Confirmar empresa/companyId usada.
- Nao misturar com testes antigos.
- Gravar tela ou tirar prints dos pontos criticos:
  - permissao bloqueada;
  - modo offline;
  - fila pendente;
  - sincronizacao concluida;
  - saldo final;
  - auditoria.

## Planilha de Registro

Criar tabela com as colunas:

| ID | Fase | Cenario | Celular | Perfil | Empresa | Acao executada | Resultado esperado | Resultado obtido | Status | Observacoes | Print/video | Data/hora |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

## Roteiro de Teste

### Fase 1 - Login Admin

Cenario:

Patrao/admin acessa o Stock Full.

Resultado esperado:

- Login funciona.
- Dashboard completo aparece.
- Admin ve:
  - cadastrar produto;
  - importar CSV;
  - exportar backup;
  - auditoria;
  - configuracoes.

### Fase 2 - Login Funcionario

Cenario:

Funcionario/operador acessa no segundo celular.

Resultado esperado:

- Login funciona.
- Funcionario ve:
  - produtos;
  - busca;
  - entrada;
  - saida;
  - saldo.
- Funcionario NAO ve ou NAO consegue usar:
  - importar CSV;
  - exportar backup;
  - auditoria completa;
  - configuracoes;
  - gerenciamento administrativo.

### Fase 3 - Cadastro pelo Admin

Cenario:

Admin cadastra: `Produto Teste Dois Celulares 2026-06-26`.

Resultado esperado:

- Produto criado com sucesso.
- Produto pertence a empresa correta.
- Saldo inicial anotado.

### Fase 4 - Validacao no Funcionario

Cenario:

Funcionario atualiza ou reabre o app.

Resultado esperado:

- Produto aparece no celular do funcionario.
- Produto pertence a mesma empresa.

### Fase 5 - Entrada de Estoque

Cenario:

Funcionario registra entrada de 10 unidades.

Resultado esperado:

- Saldo aumenta corretamente.
- Admin tambem ve saldo atualizado.

### Fase 6 - Saida de Estoque

Cenario:

Funcionario registra saida de 3 unidades.

Resultado esperado:

- Saldo reduz corretamente.
- Saldo final esperado: 7, se o saldo inicial era 0 e a entrada foi 10.

### Fase 7 - Bloqueio de Saldo Negativo

Cenario:

Funcionario tenta saida de 999 unidades.

Resultado esperado:

- Operacao bloqueada.
- Mensagem de saldo insuficiente.
- Saldo nao fica negativo.
- Nenhuma movimentacao invalida e aplicada.

### Fase 8 - Offline no Funcionario

Cenario:

Funcionario desliga internet.

Resultado esperado:

- App abre com sessao existente.
- Aparece aviso: "Modo offline - alteracoes serao sincronizadas quando a internet voltar."
- Entrada ou saida permitida e registrada como pendente.
- Fila local nao some.

### Fase 9 - Sincronizacao

Cenario:

Funcionario religa internet.

Resultado esperado:

- Fila sincroniza.
- Pendencia fica como sincronizada ou some da fila.
- Saldo e atualizado no celular do admin.
- Nao ha duplicidade.

### Fase 10 - Permissoes na Pratica

Cenario:

Funcionario tenta acessar acoes proibidas.

Resultado esperado:

- Botoes ocultos, desabilitados ou bloqueados.
- Funcionario nao acessa funcoes de patrao.
- Admin continua com acesso completo.

### Fase 11 - Concorrencia

Cenario:

Com os dois celulares online:

- funcionario registra entrada de 2;
- admin registra saida de 1 quase ao mesmo tempo.

Resultado esperado:

- Saldo final correto.
- Nenhuma movimentacao perdida.
- Nenhuma duplicidade.

### Fase 12 - Troca de Rede Durante Sync

Cenario:

Durante sincronizacao, trocar Wi-Fi para 4G ou 4G para Wi-Fi.

Resultado esperado:

- Sync continua ou retoma.
- Nenhuma operacao duplica.
- Nenhuma operacao some.

### Fase 13 - Sincronizacao Repetida

Cenario:

Forcar duas sincronizacoes da mesma operacao.

Resultado esperado:

- operationId impede duplicidade.
- Operacao e aplicada apenas uma vez.

### Fase 14 - Reinicio com Fila Pendente

Cenario:

Criar movimentacao offline. Reiniciar o celular antes de sincronizar.

Resultado esperado:

- Fila pendente continua existindo.
- Ao voltar internet, sincroniza corretamente.

### Fase 15 - Auditoria

Cenario:

Verificar auditoria das movimentacoes.

Resultado esperado:

Auditoria registra:

- usuario;
- empresa;
- data;
- hora;
- tipo de operacao;
- quantidade;
- dispositivo, se disponivel.

### Fase 16 - Mobile

Cenario:

Usar o app na vertical.

Resultado esperado:

- Sem botao cortado.
- Sem rolagem horizontal critica.
- Teclado nao cobre campos importantes.
- Texto legivel.
- Fluxo funciona com toque.

## Pontos de Atencao Especial

Dar atencao maxima a:

- concorrencia entre entrada e saida;
- troca de rede durante sync;
- sincronizacao repetida;
- reinicio do celular com fila pendente;
- auditoria com usuario, empresa e dispositivo.

## Criterio Tecnico de Reprovacao

Se falhar apenas UX pequena, registrar para ajuste posterior.

Mas NAO considerar pronto para cliente real se ocorrer qualquer um destes problemas:

- saldo negativo;
- duplicidade;
- perda de movimentacao;
- funcionario acessando funcao proibida;
- empresa A vendo dado de outra empresa;
- fila offline sumindo;
- sync aplicando operacao duas vezes.

## Criterio de Aprovacao

Considerar aprovado apenas se:

- admin e funcionario entram na mesma empresa;
- funcionario nao acessa funcoes de patrao;
- entrada e saida funcionam;
- saida maior que saldo e bloqueada;
- offline cria pendencia local;
- online sincroniza sem duplicar;
- saldo nunca fica negativo;
- auditoria registra operacoes;
- mobile funciona sem quebra critica.
