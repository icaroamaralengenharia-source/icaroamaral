# Solucao de problemas

## /elo.html nao abre

Esse problema foi corrigido no stress final. Se reaparecer, verificar sessao, rota Vite, console do navegador, requestfailed e possivel fallback indevido para ObraReport.

## Botao Pesquise nao preserva pergunta

Esse problema foi corrigido. Se reaparecer, confirmar se a pergunta original esta sendo enviada ao endpoint de busca e se a sessao tem permissao para consulta atual.

## Orcamento perdeu contexto

A retomada de contexto foi validada, inclusive com 56 m2. Se reaparecer, repetir quantidade, unidade e servico e registrar o prompt exato para auditoria.

## Historico mobile nao aparece

O historico mobile foi validado em 390x844. Se reaparecer, verificar viewport, modo read-only, overlay e clique de abrir/fechar.

## PDF saiu incompleto

Conferir filtros, periodo, itens, anexos e permissao. Para grande volume, reduzir escopo. Validacao automatizada nao substitui QA visual final.

## Stock nao deixa dar saida

Conferir saldo, empresa, ambiente e unidade. Saida acima do estoque deve ser bloqueada.

## Patrimonio offline nao salva

Comportamento esperado: offline e para leitura/consulta. Escrita deve aguardar sincronizacao segura.

## Noticias/Hunter sem itens

Verificar fonte externa e arquivos noticias/dados/*.json. Sem itens pode ser falha de fonte ou ausencia real de oportunidades nos filtros.

## Sentinela nao mostra alertas

Conferir escopo, perfil, projeto, instituicao e status. A Sentinela depende de evidencias/eventos existentes.
