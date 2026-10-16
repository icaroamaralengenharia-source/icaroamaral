# PR #231 — Provisionamento controlado de QA LIVE

Esta ferramenta é separada do runtime do produto e do diff funcional do PR #231. Ela provisiona exclusivamente dois tenants, dois usuários Auth, dois profiles normais (`gestor`) e uma obra sintética por tenant. Não cria cliente, RDO, estoque, fornecedor, documento, medição, schema ou policy.

## Alvo e segredos

O projeto esperado está fixado em `mplpzyalcxhhinuvjthx`, a referência pública do ELO em `relatorio-qualidade-obras/relatorio-config.js`. URL e ref informadas localmente precisam coincidir com esse alvo; o provisionador recusa projeto diferente.

Prepare o diretório local protegido:

```powershell
node scripts/qa/provision-live-qa-tenants.mjs --prepare-secrets
```

O comando cria `~/.elo-secrets/pr231-live-qa` sem herdar permissões de leitura amplas e informa o caminho do arquivo local. Crie `provisioner.env` nesse diretório com estas chaves, preenchidas localmente:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
LIVE_QA_EXPECTED_PROJECT_REF=mplpzyalcxhhinuvjthx
```

Não envie valores pelo chat, não os imprima e não salve o arquivo no repositório. O serviço rejeita arquivo ou diretório com ACL mais ampla que o usuário atual, SYSTEM e Administradores. A chave service-role é carregada somente pelo provisionador administrativo.

As senhas dos usuários são geradas com `crypto.randomBytes`, mantidas em `credentials.env` no mesmo diretório protegido e nunca entram nos artefatos. O provisionador não sobrescreve credenciais preexistentes.

## Ordem de execução

1. Rode `node scripts/qa/provision-live-qa-tenants.mjs --dry-run`. O comando faz somente leituras dos três alvos no namespace QA e confirma as colunas necessárias. A saída é sanitizada. Um dry-run aprovado grava um recibo local válido por 30 minutos.
2. Somente com `READY_TO_APPLY=YES`, rode `node scripts/qa/provision-live-qa-tenants.mjs --apply --confirm-live-qa`. A confirmação e o recibo recente são obrigatórios. O estado exato fica no diretório privado; o manifesto em `qa-artifacts/pr231-live-isolation/live-qa-provision-manifest.json` contém apenas fingerprints irreversíveis de IDs.
3. Rode `--verify` para conferir o provisionamento. Esse comando ainda pertence à etapa administrativa e usa service-role somente para leituras limitadas aos IDs e nomes QA.
4. Depois de fechar a etapa administrativa, não use mais service-role. A certificação funcional deve autenticar cada conta com email/senha e chave anon normais, fazendo chamadas pelo produto e pelo backend com o Bearer da própria sessão.

Modos disponíveis:

```text
--prepare-secrets
--dry-run
--apply --confirm-live-qa
--verify
--teardown --confirm-live-qa
```

O teardown nunca roda automaticamente. Ele exige o manifesto privado completo, IDs pertencentes a ele, exatamente uma profile e uma obra QA por tenant, e zero registros nas tabelas de negócio verificadas. Qualquer tabela ausente, resultado inesperado ou dado adicional bloqueia a remoção.

## Estado atual

Nenhum tenant ou usuário foi criado nesta execução. O dry-run executado ficou bloqueado porque ainda não existe configuração Supabase no subdiretório privado. A ausência de configuração não habilita um caminho alternativo.
