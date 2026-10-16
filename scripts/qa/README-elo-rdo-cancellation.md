# ELO → RDO — regressão focada de cancelamento

## Escopo

Hotfix do achado LIVE-230-001, observado após o PR #230. Não executa novamente a matriz de 100 cenários.

O assistente e o bridge compartilham a classificação de cancelamento, pergunta e espera. O roteamento preserva pontuação nesses controles. Cancelamento vincula a operação observada antes da autenticação assíncrona, aceita prévia incompleta e não confirma ou altera RDO persistido. Um token local distingue operações com o mesmo conteúdo/instante; não integra o payload persistido. Invalidação impede uma resposta de catálogo atrasada de reconstruir a prévia cancelada.

Uma confirmação já enviada ao backend não pode ser desfeita pelo cancelamento local. O estado saving retorna aviso explícito, sem alegar cancelamento ou repetir a operação.

## Testes locais

```powershell
node --test relatorio-qualidade-obras/elo-rdo-cancellation.test.cjs
node --test relatorio-qualidade-obras/elo-rdo-operational-preview.test.cjs relatorio-qualidade-obras/elo-rdo-pending-preview-routing.test.cjs relatorio-qualidade-obras/elo-rdo-commercial-regressions.test.cjs
```

Os testes de VM usam transporte sintético e não são evidência cloud. Cobrem a frase LIVE, variações/typos limitados, perguntas, espera, correção, repetição, ausência de pending, mudança de assunto, isolamento, resposta atrasada e confirmação obsoleta.

## Supabase QA real existente

```powershell
$env:ELO_CANCEL_RUN_ID='identificador-novo-de-evidencia'
node scripts/qa/elo-rdo-cancellation-cloud.mjs
```

- Requer a configuração privada já existente em .elo-secrets/elo-rdo-commercial-cloud/cloud-config.json e dependências instaladas. Não instalar/seed automaticamente.
- Allowlist fixa: wbweoizkecjjqcfkfokg.supabase.co, projeto QA independente. Verifica o marcador no banco e os claims das chaves antes de usar o backend.
- UI oficial local em 15505 e backend oficial local em 15504, com Auth/REST Supabase reais.
- Reutiliza usuários e RDOs 100% sintéticos de QA. Não provisiona recursos, altera schema, credenciais, RLS ou produção.
- 29 cenários focados: 21 variações de cancelamento na UI, espera/perguntas, correção, assunto, repetição concorrente, resposta atrasada, operação substituída, duas contas e cancelamento de edição de registro persistido.
- Os testes de concorrência também exercitam diretamente o bridge no navegador autenticado; não são todos interações manuais de UI.
- A API de QA conta e rejeita qualquer método mutante nas rotas RDO. A suíte exige zero tentativas; o bloqueio não transforma tentativa em PASS.
- Compara os JSONs integrais de todos os RDOs antes/depois por PostgREST e consulta registros pelo backend oficial. Exige CREATE_COUNT=0 e WRITE_COUNT=0.
- Evidências em qa-artifacts/elo-rdo-cancel-hotfix-20261016/<run-id>. Recusa sobrescrever rodadas.
- Capturas e logs não incluem senhas, JWTs ou chaves.

A validação cloud aqui se refere à infraestrutura QA real com aplicação em loopback. Não substitui o smoke autenticado do serviço público após uma publicação autorizada e não certifica as políticas do ambiente publicado.
