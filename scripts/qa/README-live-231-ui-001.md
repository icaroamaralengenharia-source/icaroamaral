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

O smoke identificou também que o service worker armazenava `/auth/v1/user`
sem distinguir o bearer. O login B podia receber a identidade A já armazenada.
Endpoints de identidade/Supabase e leituras com Authorization agora usam
rede com `no-store`; a ativação remove respostas privadas e caches ELO antigos.
`backend/tests/rdo-api-cache.test.cjs` cobre A→B com identidade A previamente
em cache, falha offline, ausência de bearer e limpeza na atualização.

## Regressões locais

`elo-rdo-session-binding.test.cjs` usa identidades sintéticas e proíbe escrita
de RDO. Cobre A→B→A, sessão persistida divergente, tenant divergente, logout,
falha de login, identidade retornada divergente, respostas atrasadas e a página
RDO independente. Também executar as suítes existentes de refresh, cancelamento,
roteamento, catálogo/prévia, workspace e assets, além do build.

Para reproduzir contra uma base anterior, executar a suíte nova com
`RDO_SESSION_BASELINE_REF` apontando para o commit anterior à correção.

## Smoke no preview do PR

### Transporte exclusivo do preview #233

`elo-runtime-config.js` seleciona `https://deploy-preview-233--icaroamaral.netlify.app/__pr233_live_qa`
somente quando a origem da página corresponde exatamente ao preview #233.
A Netlify Function `netlify/functions/pr233-live-qa.mjs` aceita somente esse host,
contexto `deploy-preview` e Origin ausente ou igual ao mesmo preview. Produção,
outros previews e permalinks são bloqueados. Não há wildcard de origem.

O destino é fixo no backend LIVE existente. A função encaminha o bearer normal
e os cabeçalhos de escopo ao backend, que continua decidindo usuário/tenant.
Não usa variáveis secretas, cookies ou service-role; não registra requisições.
Há allowlist de rotas/métodos para identidade, catálogo, leituras de RDO e
persistência normal da conversa ELO. Toda mutação de RDO é bloqueada antes
do backend. Respostas não são armazenadas em cache e redirects não são seguidos.

Isso resolve o bloqueio de CORS da UI pelo transporte na mesma origem do preview.
A allowlist CORS do backend LIVE não é alterada, nem há restart/deploy no Render.
A função acompanha somente o Deploy Preview automático do PR. Ela deve ser
retirada após o QA ou permanecer desativada fora desse host/contexto.

Testes: `node --test backend/tests/pr233-hosted-preview.test.mjs`.
Referência da integração: https://docs.netlify.com/build/functions/configuration/

1. Conferir os assets/versionamento do HEAD no preview.
   Confirmar que o transporte na mesma origem está ativo apenas no preview #233
   e que produção/outros previews continuam com o backend configurado originalmente.
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
