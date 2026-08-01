# Pacote Operacional Demo Municipal

Data: 2026-08-01

## Objetivo

Este pacote consolida a operacao manual para criar e homologar uma Demo Municipal real, isolada, segura e auditavel.

Ele nao cria projeto, banco, usuario, SQL ou deploy automaticamente. Todas as etapas de escrita dependem de decisao humana, ambiente isolado e confirmacao literal.

## 1. Pre-requisitos

- Repositorio em `main`, sincronizado com `origin/main`.
- Worktree limpo antes de iniciar.
- Operador com permissao formal para criar projeto demo isolado.
- Navegador com acesso ao painel do provedor escolhido.
- HTTPS real definido para o dominio da demo.
- Credenciais reais guardadas fora do Git.
- `artifacts/` confirmado no `.gitignore`.
- WhatsApp e e-mail desligados por padrao.

Arquivos de referencia:

- `docs/CHECKLIST-UNICO-DEMO-MUNICIPAL.md`
- `docs/GUIA-CRIACAO-AMBIENTE-DEMO-MUNICIPAL.md`
- `docs/OPERACAO-AMBIENTE-DEMO-MUNICIPAL.md`
- `docs/CHECKLIST-HOMOLOGACAO-DEMO-REAL.md`
- `docs/RELATORIO-FINAL-PRONTIDAO-DEMO-MUNICIPAL.md`
- `backend/src/data/municipal-demo-schema-bundle.sql`
- `backend/src/data/municipal-demo-seed.sql`
- `backend/src/data/municipal-demo-verification.sql`
- `backend/src/data/municipal-demo-cleanup.sql`

## 2. Projeto Demo Isolado

Crie manualmente um projeto exclusivo para a demo. Nao reutilize teste, E2E, producao, homologacao antiga ou projeto de cliente.

O project ref deve ser novo, dedicado e conferido visualmente antes de qualquer SQL.

Pare imediatamente se:

- o projeto aberto nao for a demo isolada;
- houver dados reais;
- houver cliente real;
- houver duvida sobre o ambiente;
- qualquer project ref bloqueado aparecer no painel, no terminal ou em arquivo local.

## 3. Dominio e HTTPS

Configure um dominio HTTPS exclusivo para a demo.

Obrigatorio:

- URL com `https://`;
- sem `localhost`;
- sem dominio de producao;
- sem dominio de cliente;
- sem URL privada em documento versionado.

## 4. Variaveis Locais

Gere somente exemplo local:

```bash
npm --prefix backend run demo:env:example
```

Crie o arquivo real apenas fora do Git, em local seguro do operador. O arquivo real deve conter:

- `APP_ENV=demo`
- `MUNICIPAL_DEMO_MODE=true`
- `MUNICIPAL_WHATSAPP_ENABLED=false`
- `MUNICIPAL_EMAIL_ENABLED=false`
- `RUN_DEMO_LIVE_TESTS=false` ate a homologacao live autorizada
- URL HTTPS da demo
- project ref demo isolado

Nunca versionar credenciais, tokens, chave administrativa, senha, string de conexao ou UUID completo de usuario real.

## 5. Usuarios Ficticios

Crie manualmente usuarios ficticios, sem dados pessoais reais:

- platform admin demo;
- municipal admin demo;
- gestor demo;
- leitura demo.

Registre os UUIDs completos somente em arquivo local seguro fora do Git. Em evidencias versionadas, use apenas valores mascarados.

## 6. Preflight

Execute o preflight em dry-run:

```bash
npm --prefix backend run demo:preflight
```

Resultado esperado:

- ambiente demo validado;
- HTTPS validado;
- WhatsApp/e-mail desligados;
- project ref aceito;
- projetos bloqueados rejeitados;
- nenhuma conexao aberta;
- nenhum SQL executado.

## 7. Dry-run

Execute validacoes locais:

```bash
npm --prefix backend run demo:apply-schema
npm --prefix backend run demo:apply-seed
npm --prefix backend run demo:verify
npm --prefix backend run demo:cleanup
npm --prefix backend run demo:smoke:local
npm --prefix backend run demo:full:dry-run
```

Esses comandos sao dry-run por padrao. Eles nao devem abrir conexao real nem aparentar sucesso de escrita.

## 8. Aplicacao Manual do Schema

**ESCRITA MANUAL - exige operador e confirmacao literal.**

Arquivo:

- `backend/src/data/municipal-demo-schema-bundle.sql`

Antes de executar:

- confirmar projeto demo isolado no painel;
- confirmar SHA-256 do arquivo;
- confirmar ausencia de credenciais;
- confirmar ausencia de projeto bloqueado;
- confirmar que nao ha `DROP`, `TRUNCATE`, `DELETE FROM`, `INSERT INTO` de dados reais ou `UPDATE ... SET`.

CLI segura, se autorizada operacionalmente:

```bash
node backend/scripts/municipal-demo-apply-schema.js --execute --confirm APLICAR_SCHEMA_DEMO
```

Caso use SQL Editor, copie o arquivo integralmente e execute uma unica vez. Nao repetir em caso de erro sem analise.

## 9. Aplicacao Manual do Seed

**ESCRITA MANUAL - exige operador e confirmacao literal.**

Arquivo:

- `backend/src/data/municipal-demo-seed.sql`

Antes de executar:

- substituir placeholders apenas com usuarios ficticios;
- confirmar que o seed nao cria `auth.users`;
- confirmar prefixo `DEMO_MUNICIPAL_`;
- confirmar que WhatsApp/e-mail seguem desligados.

CLI segura, se autorizada operacionalmente:

```bash
node backend/scripts/municipal-demo-apply-seed.js --execute --confirm APLICAR_SEED_DEMO
```

## 10. Verification

Arquivo somente leitura:

- `backend/src/data/municipal-demo-verification.sql`

Execute manualmente apos schema e seed:

```bash
npm --prefix backend run demo:verify
```

Se for usar SQL Editor, copiar apenas o verification. Ele deve conter somente `SELECT`, `WITH` e comentarios.

Validar:

- tabelas esperadas;
- RLS;
- policies;
- indices;
- constraints;
- ausencia de registros sem `institution_id`;
- ausencia de `unit_id` invalido;
- ausencia de duplicidades.

## 11. Health

Executar smoke local e health da aplicacao:

```bash
npm --prefix backend run demo:smoke:local
```

Validar:

- aplicacao sobe localmente;
- ausencia de IA nao derruba o fluxo;
- WhatsApp/e-mail seguem desligados;
- nenhuma conexao externa ocorre no smoke local.

## 12. Painel

Validar visualmente:

- login;
- Visao Geral;
- Almoxarifados;
- Sentinela;
- Relatorios;
- Acervo;
- Patrimonio;
- Auditoria;
- Notificacoes;
- Assistente ELO.

O painel nao deve expor `institution_id`, `unit_id`, UUID completo, token ou storage path cru.

## 13. Offline

Validar patrimonio offline:

- cache por institution_id, unit_id e user_id;
- busca local por tombamento, nome, categoria, unidade e responsavel;
- detalhe e historico ja sincronizados;
- indicador de ultima sincronizacao;
- escrita offline bloqueada;
- logout invalida cache sensivel.

## 14. Homologacao Live

Live so pode ocorrer com autorizacao explicita e ambiente demo isolado.

Padrao seguro:

- `RUN_DEMO_LIVE_TESTS=false`

Para live autorizada, registrar em evidencia separada:

- operador;
- data/hora;
- projeto confirmado;
- dominio HTTPS;
- resultados;
- falhas;
- prints ou logs sanitizados.

Nao executar live em projeto de teste, producao, cliente ou E2E.

## 15. Backup

Antes de qualquer escrita:

- registrar SHA-256 dos arquivos SQL;
- exportar metadados permitidos;
- registrar estado inicial;
- salvar evidencia sanitizada em `artifacts/` ou local seguro fora do Git.

Nao incluir dados pessoais reais em evidencia versionada.

## 16. Rollback

Rollback e manual, filtrado e documentado.

Arquivo:

- `backend/src/data/municipal-demo-cleanup.sql`

**ESCRITA MANUAL - exige operador e confirmacao literal.**

CLI segura, se autorizada operacionalmente:

```bash
node backend/scripts/municipal-demo-cleanup.js --execute --confirm REMOVER_DADOS_DEMO_MUNICIPAL
```

Nunca executar cleanup sem verificar prefixo demo, escopo e ambiente.

## 17. Cleanup

Cleanup so remove dados demo filtrados. Ele nao deve tocar em:

- `auth.users`;
- dados reais;
- projetos fora da demo;
- dados sem prefixo `DEMO_MUNICIPAL_`.

Pare se houver `DROP`, `TRUNCATE` ou `DELETE` sem filtro.

## 18. Evidencias

Gerar evidencia sanitizada:

```bash
npm --prefix backend run demo:evidence:dry-run
```

Registrar:

- branch;
- HEAD;
- operador;
- project ref mascarado;
- dominio mascarado;
- hashes dos SQLs;
- resultados de preflight, dry-run, verification, health, painel, offline e live;
- decisao final.

Nao registrar senha, token, chave administrativa, string de conexao, e-mail, telefone, CPF, URL privada ou UUID completo.

## 19. Criterios de Aprovacao

A demo pode ser aprovada quando:

- preflight passa;
- dry-run passa;
- schema aplicado uma unica vez;
- seed aplicado uma unica vez;
- verification sem inconsistencias;
- health ok;
- painel ok em desktop/tablet/mobile;
- offline ok;
- live autorizada ok;
- evidencias completas e sanitizadas;
- WhatsApp/e-mail desligados;
- rollback documentado.

## 20. Criterios de Parada Imediata

Pare imediatamente se:

- projeto incorreto;
- ambiente com dados reais;
- credencial impressa;
- UUID completo em evidencia versionada;
- comando com `--execute` sem confirmacao literal;
- tentativa de ativar live por padrao;
- WhatsApp/e-mail ativados;
- SQL destrutivo inesperado;
- erro de RLS;
- vazamento entre tenants;
- falha de verification;
- operador nao consegue explicar o proximo passo.

## Decisao

PACOTE OPERACIONAL PRONTO PARA EXECUCAO MANUAL DA DEMO REAL
