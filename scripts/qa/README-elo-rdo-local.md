# QA local ELO → RDO

Este ambiente é isolado em loopback e usa PostgreSQL real, o schema oficial de RDO e o backend oficial. A autenticação por senha/JWT e o protocolo REST são implementações locais de infraestrutura de QA. **Não é uma instalação do Supabase cloud e não comprova o comportamento do GoTrue/PostgREST/RLS em cloud.**

## Reproduzir

Pré-requisitos: Node.js, dependências dos lockfiles, PostgreSQL 17 e Chromium do Playwright já instalado. É possível indicar `ELO_QA_PG_BIN` e `ELO_QA_CHROMIUM_EXECUTABLE`.

1. `node scripts/qa/elo-rdo-environment-survey.mjs qa-artifacts/elo-rdo-commercial-certification-20261015/environment-survey.json`
2. `node scripts/qa/elo-rdo-local-db.mjs`
3. Em um terminal: `node scripts/qa/elo-rdo-local-stack.mjs`
4. Em outro: `node scripts/qa/elo-rdo-local-preflight.mjs`
5. `node scripts/qa/elo-rdo-commercial-local-suite.mjs`

O catálogo scripts/qa/elo-rdo-commercial-cases.json contém os 100 IDs e objetivos fornecidos pelo usuário. O runner implementa assertivas específicas e registra uma execução independente por caso, em contextos de navegador novos. ELO_QA_CASES=21,55 seleciona retestes sem inflar o total de cenários. ELO_QA_RUN_ID identifica a execução.

## Recursos

- PostgreSQL: 127.0.0.1:55473; banco elo_rdo_commercial_20261015.
- Provedor local de autenticação e protocolo SQL: 127.0.0.1:15473.
- Backend oficial: 127.0.0.1:15474.
- Frontend oficial com configuração local: 127.0.0.1:15475.
- Dois tenants sintéticos, cinco obras e 38 RDOs de seed.
- Credenciais geradas em .elo-secrets, ignoradas pelo Git. Nunca copiar para logs ou dossiê.
- Nenhuma variável ou credencial de produção é carregada pelo stack local.
- O backend bloqueia fetch externo; o navegador bloqueia hosts fora de loopback.
- A limpeza automática global de telemetria é desativada no processo de QA.
- O schema RDO oficial é aplicado sem alterações; somente as tabelas fundamentais de identidade necessárias são extraídas dos SQLs versionados.
- O processo não aplica migrations a qualquer Supabase publicado.

## Evidências e limites

Cada caso salva JSON individual com entrada, saída, timestamps, duração, chamadas de backend sem headers de autenticação, verificação SQL e operações de escrita. Capturas usam máscara no campo de senha. Falhas de rede/respostas incompletas são injeções controladas e identificadas.

Os resultados locais não devem ser apresentados como E2E Supabase cloud. O gate comercial permanece parcial enquanto os requisitos de homologação de fornecedor, os 100 casos e os demais gates não estiverem comprovados.

Não executar o runner contra URLs de produção. Ele usa somente os endereços locais constantes, dados sintéticos e credenciais locais geradas.
