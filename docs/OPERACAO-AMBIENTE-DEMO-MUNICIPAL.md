# Operacao do Ambiente Demo Municipal

Este documento descreve as ferramentas seguras de provisionamento da demo municipal. Todas operam em dry-run por padrao e nao devem ser usadas contra E2E, producao ou qualquer banco com dados reais.

## Projetos Bloqueados

As ferramentas bloqueiam qualquer URL ou configuracao que contenha:

- `mplpzyalcxhhinuvjthx`
- `lidueokjpzxdybtongbk`

Se um desses identificadores aparecer no ambiente, argumento ou arquivo SQL, a operacao falha antes de qualquer tentativa de execucao.

## Scripts

Executar a partir de `backend/` ou informando `--root` para a raiz do repositorio.

- `npm run demo:preflight`
- `npm run demo:apply-schema`
- `npm run demo:apply-seed`
- `npm run demo:verify`
- `npm run demo:cleanup`

Equivalentes diretos:

- `node scripts/municipal-demo-preflight.js`
- `node scripts/municipal-demo-apply-schema.js`
- `node scripts/municipal-demo-apply-seed.js`
- `node scripts/municipal-demo-verify.js`
- `node scripts/municipal-demo-cleanup.js`

## Dry-run Padrao

Sem `--execute`, os scripts apenas validam:

- arquivo SQL esperado;
- SHA-256;
- comandos perigosos;
- projetos bloqueados;
- segredos acidentais;
- placeholders pendentes;
- configuracao demo minima.

Nenhum SQL e executado em dry-run.

## Confirmacoes Literais

Escrita exige `--execute` e confirmacao literal:

- Schema: `--confirm APLICAR_SCHEMA_DEMO`
- Seed: `--confirm APLICAR_SEED_DEMO`
- Verificacao: `--confirm VERIFICAR_DEMO_MUNICIPAL`
- Cleanup: `--confirm REMOVER_DADOS_DEMO_MUNICIPAL`

Sem a confirmacao correta, o comando falha antes de qualquer execucao. Quando `--project-ref` for informado, ele deve bater com o project ref extraido de `DEMO_SUPABASE_URL`.

## Seed

O seed exige UUIDs reais de usuarios ficticios ja criados no Auth do banco demo isolado:

- `--platform-admin-user-id`
- `--municipal-admin-user-id`
- `--gestor-user-id`
- `--leitura-user-id`

Os scripts validam formato UUID e nunca imprimem UUID completo.

## Saida Sanitizada

A saida mascara:

- URLs;
- tokens;
- senhas;
- service role;
- chaves;
- UUIDs completos.

Nao cole logs com segredos no terminal. Se uma credencial aparecer por erro externo, descarte o log.

## Execucao Real

Nesta etapa, a execucao automatica de SQL permanece sem executor real configurado. Mesmo com `--execute`, se nao houver executor seguro injetado pela automacao autorizada, o script retorna `automatic_sql_execution_not_configured`.

A aplicacao manual via SQL Editor continua sendo o caminho aprovado ate existir ferramenta de execucao auditada e autorizada.


## Dry-runs Locais da Etapa 50

- `npm run demo:env:example`: valida a geracao do exemplo de ambiente sem sobrescrever arquivo real.
- `npm run demo:smoke:local`: valida app, arquivos, SQLs e integracoes desligadas sem banco.
- `npm run demo:evidence:dry-run`: monta evidencia sanitizada sem gravar por padrao.
- `npm run demo:full:dry-run`: executa preflight, schema, seed, verification, cleanup e smoke somente em dry-run.

Nenhum desses comandos passa `--execute`, abre conexao real, acessa Supabase ou executa SQL.
## Fluxo Recomendado

1. Rodar `npm run demo:preflight`.
2. Criar banco demo isolado manualmente.
3. Aplicar `municipal-demo-schema-bundle.sql` manualmente.
4. Criar usuarios ficticios no Auth demo.
5. Substituir placeholders ou validar seed via `demo:apply-seed` em dry-run.
6. Aplicar seed manualmente.
7. Rodar `municipal-demo-verification.sql` manualmente.
8. Registrar evidencias.
9. Validar painel e offline.
10. Usar cleanup manual apenas se necessario.

## Travas Permanentes

- Nao usar force, deploy automatico ou Supabase CLI nesta operacao.
- Nao criar usuario real.
- Nao ativar WhatsApp ou e-mail.
- Nao usar E2E nem producao como demo.
- Nao executar cleanup sem revisao humana.
