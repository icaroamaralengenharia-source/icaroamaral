# Manual Patrimonio e Inventario

Status: producao assistida.
Classificacao: COMPROVADA_COM_RESSALVA.
Rota principal: /municipal-admin.html.

## Para que serve

O modulo municipal organiza patrimonio, inventario, documentos, notificacoes, auditoria e visao por unidade/instituicao. Os testes cobrem consulta por tombamento, isolamento, historico, offline de leitura e sincronizacao controlada.

## Uso basico

1. Abrir /municipal-admin.html.
2. Selecionar a aba Patrimonio.
3. Buscar por tombamento, nome, categoria, estado ou local.
4. Abrir detalhe para historico e situacao do bem.
5. Registrar alteracoes apenas com perfil autorizado e ambiente online.
6. Em offline, usar consulta como leitura; escrita offline deve permanecer bloqueada.

## Perfis

Platform admin e municipal admin administram. Gestor opera dentro do escopo autorizado. Leitura consulta sem escrita. O backend e a fonte final de autorizacao.

## Limitacoes

Demonstracoes municipais dependem de ambiente Supabase, usuarios ficticios/validos e scripts de provisionamento. Nao assumir operacao nacional ou multi-prefeitura sem homologacao do ambiente real.
