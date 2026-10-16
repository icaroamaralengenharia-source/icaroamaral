# ELO → RDO: homologação Supabase isolada

Este runner usa GoTrue, PostgREST e PostgreSQL reais do projeto de QA
`wbweoizkecjjqcfkfokg`, criado na organização Free com autorização do usuário.
Ele é distinto dos projetos publicados/encontrados `mplpzyalcxhhinuvjthx` e
`lidueokjpzxdybtongbk`. Não remova as allowlists nem reutilize secrets de produção.

## Arquitetura e credenciais

- Frontend oficial com configuração local: `http://127.0.0.1:15485/elo.html`.
- Backend oficial `createApp` e repositório Supabase: `127.0.0.1:15484`.
- Auth/REST: `https://wbweoizkecjjqcfkfokg.supabase.co`.
- Credenciais exclusivas em `.elo-secrets/elo-rdo-commercial-cloud/cloud-config.json`,
  ignoradas pelo Git. Nunca imprimir seu conteúdo ou incluir em evidências.
- O projeto e o papel dos JWTs são conferidos na configuração. O stack exige
  marcador de ambiente no banco antes de iniciar. Fetch externo é restrito ao host QA.
- Não há adaptador local de autenticação/REST nesta variante.

O schema RDO oficial é aplicado sem alterações. As tabelas fundamentais de identidade
e as funções de catálogo de obras são extraídas dos SQLs oficiais. A instalação inicial
`cloud-init.sql`, gerada por `elo-rdo-cloud-prepare.mjs`, recusa schema público não vazio
e deve ser revisada e executada somente no SQL Editor do projeto QA autorizado.
Não reinstalar em ambiente existente. A instalação não requer senha de Postgres local.

RLS de QA: tabelas protegidas de acesso direto por anon/authenticated; leitura de perfil
restrita à própria conta; RPC oficial de obras usa o tenant da sessão. O backend oficial
usa sua identidade de serviço e suas verificações canônicas. Isso não prova paridade
das políticas/configuração com produção. Não foram alterados Stock ou o schema RDO oficial.

## Executar na infraestrutura já configurada

```powershell
node scripts/qa/elo-rdo-cloud-stack.mjs
# Em outro terminal:
$env:ELO_QA_RUN_ID='rodada-unica-ainda-inexistente'
Remove-Item Env:ELO_QA_CASES -ErrorAction SilentlyContinue
node scripts/qa/elo-rdo-commercial-cloud-suite.mjs
```

Exige Chromium Playwright e dependências existentes do projeto. Não baixa navegador,
Docker ou CLI Supabase. A base contém duas contas, dois tenants, cinco obras e 38 RDOs
sintéticos de seed; as criações autorizadas aumentam somente essa base.

Os casos 068, 069 e 100 podem criar um RDO cada. O 069 descarta a resposta após commit
e faz uma nova confirmação explícita para verificar idempotência. O 070 injeta resposta
HTTP sem persistência. Falhas de rede são identificadas e sua interceptação é contada.
Service workers são bloqueados para permitir essas interceptações; o PWA publicado
não é certificado por esses testes. Os demais casos exigem RDOs integralmente inalterados.

Cada execução recusa sobrescrever evidências anteriores. Retestes seletivos usam
`ELO_QA_CASES`, por exemplo `27`. Não somar retestes ao total dos 100 IDs obrigatórios.
O caso 076 exige execução completa iniciando no 001: guarda um JWT GoTrue original
e comprova sua expiração real. JWTs QA duram 300 segundos; refresh fica indisponível
como falha controlada nesse cenário. A cadência respeita os limites de login do fornecedor.

## Calendário e rastreabilidade

O relógio da interface é fixado na referência 15/10/2026 em America/Bahia. O caso 027
usa `2026-10-01T01:00:00Z`, equivalente a 30/09/2026 local. A tentativa inicial com
novembro futuro ultrapassou a validade do JWT real e bloqueou corretamente a autenticação
antes da consulta de RDO. Essa evidência foi preservada e classificada como fixture.
A virada futura original passou na integração local; a cloud repete a mesma exigência
de calendário em uma virada anterior compatível com autenticação real.

JSONs individuais registram versão, hash do produto, mensagens, chamadas sanitizadas,
assertivas, injeções e snapshots antes/depois obtidos do PostgREST. O backend precisa
recuperar o registro por GET para afirmar criação. A aplicação roda localmente: a prova
cloud não substitui o smoke do pacote publicado após autorização de publicação.

Sem merge, deploy oficial, migration ou escrita na base publicada por estes scripts.
