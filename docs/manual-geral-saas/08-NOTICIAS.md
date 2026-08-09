# Manual Noticias

Status: producao assistida.
Classificacao: COMPROVADA_COM_RESSALVA.
Rota principal: /noticias/.

## Para que serve

A pagina mostra noticias, dicas revisadas, oportunidades e licitacoes. Os dados ficam em arquivos JSON dentro de noticias/dados e podem ser atualizados por automacao.

## Uso

1. Abrir /noticias/.
2. Selecionar Noticias, Dicas, Oportunidades ou Hunter Licitacoes.
3. Usar filtros e busca.
4. Abrir a fonte original para ler o conteudo completo.

## Regras editoriais

A pagina nao deve copiar materia completa. Deve exibir titulo, resumo curto, data, fonte e link. Dicas so aparecem quando revisadas manualmente.

## Automacao

Ha script de atualizacao de noticias/oportunidades e workflow que pode commitar apenas arquivos de dados de Noticias. Esse comportamento explica bloqueios de fast-forward quando origin/main avanca somente por noticias/dados/*.

## Limitacoes

Fontes externas podem sair do ar, mudar formato ou retornar poucos dados. Sempre conferir a publicacao original antes de decisao.
