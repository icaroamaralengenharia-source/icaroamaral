# LIVE-231-UI-001 — vínculo de sessão no ELO

## Correção

No ELO público, a sessão ELO ativa determina o usuário e a instituição usados
para consultar o catálogo e preparar a prévia. Uma sessão RDO persistida de
outra identidade é descartada. Na página RDO, a sessão própria continua válida
quando corresponde à identidade dessa página.

Logout, novo login e mudança de identidade removem a autoridade RDO anterior,
catálogo/contexto e pendências, inclusive de outra conversa. Respostas atrasadas
de login, refresh, identity merge e catálogo não podem restaurar a sessão antiga.
Falha na sessão ELO ativa bloqueia a operação sem recorrer à sessão RDO antiga.
Os scripts e o service worker recebem nova versão de cache.

## Regressões locais

`elo-rdo-session-binding.test.cjs` usa identidades sintéticas e proíbe escrita
de RDO. Cobre A→B→A, sessão persistida divergente, tenant divergente, logout,
falha de login, identidade retornada divergente, respostas atrasadas e a página
RDO independente. Também executar as suítes existentes de refresh, cancelamento,
roteamento, catálogo/prévia, workspace e assets, além do build.

Para reproduzir contra uma base anterior, executar a suíte nova com
`RDO_SESSION_BASELINE_REF` apontando para o commit anterior à correção.

## Smoke no preview do PR

1. Conferir os assets/versionamento do HEAD no preview.
2. Usar somente as credenciais normais dos usuários QA LIVE A e B já existentes.
3. Registrar apenas contagens e hashes das leituras de RDO antes/depois.
4. Entrar como A, conferir a identidade visível, pedir prévia apenas para
   `ELO_QA_LIVE_WORK_A` e cancelar sem confirmar.
5. Sair e entrar como B; verificar que o histórico/pendência anterior foi limpo,
   conferir a identidade visível e a prévia de `ELO_QA_LIVE_WORK_B`; cancelar.
6. Repetir B→A. Não criar, confirmar, atualizar ou salvar RDO.
7. Comparar contagens/hashes e anexar somente evidência sanitizada ao PR.

O gate backend LIVE do PR #231 permanece como evidência já certificada.
Este smoke não o substitui nem repete o provisionamento. Não ler configuração
de provisionamento nem usar service-role. Preservar o PR #232 em draft.
O PR desta correção deve permanecer aberto; parar antes de merge/deploy de produção.
