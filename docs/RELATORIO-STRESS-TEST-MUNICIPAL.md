# Relatorio Stress Test Municipal

## Estado

- HEAD: `0ef7ffe`
- Branch: `main`
- Seed backend total: `municipal-total-stress-v1`
- Seed concorrencia: `municipal-concurrency-stress-v1`
- Seed seguranca: `municipal-security-stress-v1`
- Seed chaos UI: `municipal-chaos-stress-v1`
- Ambiente: local/mocked controlado
- Banco real: nao acessado
- Supabase: nao acessado
- SQL: nao executado
- Deploy: nao realizado

## Cenarios Cobertos

- Multi-tenant e permissoes.
- Estoque e saldo concorrente.
- Patrimonio e historico.
- Notificacoes e Sentinela.
- Acervo e relatorios.
- Offline e cache por escopo.
- Chaos/resiliencia de painel.
- Seguranca de payloads hostis.

## Operacoes Executadas

Total minimo simulado: 4.857 operacoes/eventos.

- 520 combinacoes de autorizacao e escopo.
- 1.000 operacoes de estoque sequenciais.
- 500 bens patrimoniais.
- 1.000 notificacoes/deduplicacoes no fluxo total.
- 20 operacoes concorrentes no mesmo item.
- 20 tentativas concorrentes com mesmo `operation_id`.
- 1.000 notificacoes concorrentes com 50 chaves deduplicadas.
- 50 leituras/cancelamentos concorrentes.
- 20 transferencias concorrentes de patrimonio.
- 600 payloads hostis em lote.
- 100 navegacoes rapidas de painel.
- Desktop, tablet e celular no chaos UI.

## Concorrencia

- Concorrencia maxima controlada: 20 operacoes simultaneas por item/bem.
- Saldo final igual a entradas menos saidas aprovadas.
- Auditoria igual ao numero de operacoes aceitas.
- `operation_id` repetido nao duplicou saldo.
- `deduplication_key` repetida nao duplicou notificacao.
- Transferencias simultaneas preservaram versao e historico.

## Duracao Observada

- `municipal-total-stress`: 3/3 em aproximadamente 143 ms.
- `municipal-concurrency-stress`: 5/5 em aproximadamente 153 ms.
- `municipal-security-stress`: 3/3 em aproximadamente 135 ms.
- `municipal-chaos-stress`: 4/4 em aproximadamente 8,5 s apos correcao da spec.
- Regressao notificacoes: 9/9 em aproximadamente 319 ms.
- Regressao notificacoes isolamento: 4/4 em aproximadamente 1,19 s.
- Regressao patrimonio: 5/5 em aproximadamente 308 ms.
- Regressao patrimonio isolamento: 3/3 em aproximadamente 1,18 s.
- Schema safety: 7/7 em aproximadamente 246 ms.

## Memoria

- O teste de seguranca falha se o lote hostil gerar crescimento acima de 40 MB de heap.
- Crescimento anormal de memoria nao foi observado.

## Resultados

- Checks de sintaxe: 4/4 aprovados.
- Stress backend: 11/11 aprovados.
- Chaos Playwright: 4/4 aprovados na execucao final.
- Regressao critica: 28/28 aprovados.
- Total final de testes executados nesta etapa: 43/43 aprovados.

## Isolamento

- Nenhum vazamento entre `institution_id` diferentes foi aceito no harness.
- Gestor ficou limitado a unidade autorizada.
- Leitura nao executou escrita.
- IDs enviados no payload nao sobrescreveram escopo de sessao.
- `project_id` foi rejeitado como escopo municipal.

## Seguranca

Payloads testados:

- SQL injection.
- XSS.
- Path traversal.
- JSON profundo.
- String de 10.000 caracteres.
- Campos inesperados.
- UUID/texto invalido.
- Token/JWT em campo comum.
- Prototype pollution.

Resultado:

- Rejeicao segura.
- Logs sanitizados.
- Nenhum segredo exposto.
- Prototype pollution nao contaminou `Object.prototype`.

## Offline

- Cache separado por `institution_id + unit_id + user_id`.
- Busca offline por tombamento validada.
- Cache vazio retorna estado seguro.
- Falha de sincronizacao preserva ultimo cache valido.
- Logout remove cache sensivel.
- Nenhum token e persistido no cache.
- Escrita offline permanece bloqueada pela modelagem do teste.

## Resiliencia

Simulado no Playwright:

- HTTP 400, 401, 403, 404, 409, 429 e 500.
- Resposta malformada.
- Rede offline e retorno online.
- Clique duplo.
- Resposta fora de ordem.
- 100 navegacoes rapidas.
- Desktop, tablet e celular.

O painel de teste:

- Nao travou completamente.
- Nao exibiu segredo.
- Nao misturou tenant externo.
- Nao duplicou escrita confirmada.
- Manteve estado seguro em falhas.

## Defeitos Encontrados

- A primeira versao da spec Playwright retornava funcoes por `exposeFunction`, gerando erro de serializacao e vazamento de texto de fixture na UI de teste.
- A primeira versao do teste de clique duplo nao tinha guarda idempotente no harness de UI.
- A primeira versao da navegacao rapida contava abas que nao chamavam API, reduzindo o numero de chamadas reais.
- A primeira versao do teste de seguranca nao rejeitava string de 10.000 caracteres nem `constructor/prototype` em JSON.

## Correcoes Realizadas

- Spec chaos passou a retornar apenas objetos serializaveis.
- UI mock ganhou guarda `archiving` para clique duplo.
- Navegacao rapida passou a usar 100 rotas que chamam API de fato.
- Validador de seguranca do harness passou a rejeitar campos longos, inesperados e prototype pollution com chaves JSON.
- Sanitizacao de log passou a redigir `Bearer/JWT/service_role/token` tambem na amostra.

## Riscos Restantes

- Suite executada em mocks e ambiente local controlado, sem banco real.
- Nao substitui homologacao funcional no ambiente demo quando ele for criado.
- Playwright usou uma UI isolada de chaos para falhas extremas, nao a pagina municipal real.
- Sem metricas de banco, lock real, RLS real ou latencia real de rede.

## Decisao

APROVADO COM RESSALVAS

Motivo: todos os testes locais/mocked finais passaram e os criterios minimos foram cobertos, mas a demo real ainda nao existe e nenhum banco/Supabase foi acessado por trava da etapa.
