# Checklist Unico Demo Municipal

Use este checklist do inicio ao fim. Marque cada item manualmente. Se qualquer item falhar, pare e registre a evidencia.

## 1. Pre-requisitos

- [ ] Repositorio em `main`.
- [ ] `git status --short` limpo.
- [ ] Operador autorizado.
- [ ] Credenciais reais fora do Git.
- [ ] `artifacts/` ignorado pelo Git.
- [ ] WhatsApp/e-mail desligados.

## 2. Projeto Demo Isolado

- [ ] Criar projeto demo exclusivo manualmente.
- [ ] Confirmar que nao e E2E, producao, cliente ou homologacao antiga.
- [ ] Registrar project ref apenas em arquivo local seguro.
- [ ] Conferir visualmente o projeto antes de qualquer SQL.

## 3. Dominio e HTTPS

- [ ] Definir dominio dedicado.
- [ ] Confirmar `https://`.
- [ ] Bloquear `localhost`.
- [ ] Nao registrar URL privada em Git.

## 4. Variaveis Locais

- [ ] Rodar `npm --prefix backend run demo:env:example`.
- [ ] Criar env real apenas fora do Git.
- [ ] Confirmar `APP_ENV=demo`.
- [ ] Confirmar `MUNICIPAL_DEMO_MODE=true`.
- [ ] Confirmar `MUNICIPAL_WHATSAPP_ENABLED=false`.
- [ ] Confirmar `MUNICIPAL_EMAIL_ENABLED=false`.
- [ ] Confirmar `RUN_DEMO_LIVE_TESTS=false`.

## 5. Usuarios Ficticios

- [ ] Criar platform admin ficticio.
- [ ] Criar municipal admin ficticio.
- [ ] Criar gestor ficticio.
- [ ] Criar leitura ficticio.
- [ ] Nao usar e-mail, CPF, telefone ou usuario real.
- [ ] Guardar UUIDs completos somente fora do Git.

## 6. Preflight

- [ ] Rodar `npm --prefix backend run demo:preflight`.
- [ ] Confirmar que o resultado e dry-run.
- [ ] Confirmar nenhuma conexao.
- [ ] Confirmar nenhum SQL executado.
- [ ] Confirmar projeto demo aceito.
- [ ] Confirmar projetos bloqueados rejeitados.

## 7. Dry-run

- [ ] Rodar `npm --prefix backend run demo:apply-schema`.
- [ ] Rodar `npm --prefix backend run demo:apply-seed`.
- [ ] Rodar `npm --prefix backend run demo:verify`.
- [ ] Rodar `npm --prefix backend run demo:cleanup`.
- [ ] Rodar `npm --prefix backend run demo:full:dry-run`.
- [ ] Confirmar que nenhum comando usa `--execute`.

## 8. Aplicacao Manual do Schema

- [ ] **ESCRITA MANUAL:** confirmar operador.
- [ ] Abrir `backend/src/data/municipal-demo-schema-bundle.sql`.
- [ ] Conferir SHA-256.
- [ ] Conferir ausencia de credenciais.
- [ ] Conferir ausencia de `DROP`, `TRUNCATE`, `DELETE FROM` destrutivo e `UPDATE ... SET`.
- [ ] Confirmar projeto demo isolado no painel.
- [ ] Executar uma unica vez.
- [ ] Se usar CLI segura, exigir `--confirm APLICAR_SCHEMA_DEMO`.

Comando CLI de escrita, somente com autorizacao:

```bash
node backend/scripts/municipal-demo-apply-schema.js --execute --confirm APLICAR_SCHEMA_DEMO
```

## 9. Aplicacao Manual do Seed

- [ ] **ESCRITA MANUAL:** confirmar operador.
- [ ] Abrir `backend/src/data/municipal-demo-seed.sql`.
- [ ] Substituir placeholders por usuarios ficticios.
- [ ] Confirmar que nao cria `auth.users`.
- [ ] Confirmar prefixo `DEMO_MUNICIPAL_`.
- [ ] Executar uma unica vez.
- [ ] Se usar CLI segura, exigir `--confirm APLICAR_SEED_DEMO`.

Comando CLI de escrita, somente com autorizacao:

```bash
node backend/scripts/municipal-demo-apply-seed.js --execute --confirm APLICAR_SEED_DEMO
```

## 10. Verification

- [ ] Abrir `backend/src/data/municipal-demo-verification.sql`.
- [ ] Confirmar que contem somente `SELECT`, `WITH` e comentarios.
- [ ] Executar verification.
- [ ] Confirmar tabelas.
- [ ] Confirmar RLS.
- [ ] Confirmar policies.
- [ ] Confirmar indices.
- [ ] Confirmar constraints.
- [ ] Confirmar zero inconsistencias.

## 11. Health

- [ ] Rodar `npm --prefix backend run demo:smoke:local`.
- [ ] Confirmar health ok.
- [ ] Confirmar que ausencia de IA nao derruba validacao.
- [ ] Confirmar WhatsApp/e-mail desligados.

## 12. Painel

- [ ] Login platform admin.
- [ ] Login municipal admin.
- [ ] Login gestor.
- [ ] Login leitura.
- [ ] Validar Visao Geral.
- [ ] Validar Almoxarifados.
- [ ] Validar Sentinela.
- [ ] Validar Relatorios.
- [ ] Validar Acervo.
- [ ] Validar Patrimonio.
- [ ] Validar Auditoria.
- [ ] Validar Notificacoes.
- [ ] Validar Assistente ELO.

## 13. Offline

- [ ] Sincronizar patrimonio autorizado.
- [ ] Desconectar rede.
- [ ] Buscar por tombamento.
- [ ] Abrir detalhe.
- [ ] Ver historico sincronizado.
- [ ] Confirmar ultima sincronizacao.
- [ ] Confirmar escrita offline bloqueada.
- [ ] Logout invalida cache.

## 14. Homologacao Live

- [ ] Confirmar autorizacao explicita.
- [ ] Confirmar projeto demo isolado.
- [ ] Confirmar `RUN_DEMO_LIVE_TESTS=true` somente nesta janela manual.
- [ ] Executar por blocos.
- [ ] Nao repetir automaticamente falha.
- [ ] Registrar evidencia sanitizada.

## 15. Backup

- [ ] Registrar hashes dos SQLs.
- [ ] Registrar estado inicial.
- [ ] Salvar evidencia local segura.
- [ ] Nao versionar dados pessoais.

## 16. Rollback

- [ ] Abrir `backend/src/data/municipal-demo-cleanup.sql`.
- [ ] Confirmar filtros demo.
- [ ] Confirmar ausencia de `DROP` e `TRUNCATE`.
- [ ] Confirmar que nao toca `auth.users`.
- [ ] Se usar CLI segura, exigir `--confirm REMOVER_DADOS_DEMO_MUNICIPAL`.

Comando CLI de escrita, somente com autorizacao:

```bash
node backend/scripts/municipal-demo-cleanup.js --execute --confirm REMOVER_DADOS_DEMO_MUNICIPAL
```

## 17. Cleanup

- [ ] Executar somente se rollback/limpeza for aprovado.
- [ ] Conferir prefixo demo antes.
- [ ] Registrar resultado.
- [ ] Nao repetir sem analise.

## 18. Evidencias

- [ ] Rodar `npm --prefix backend run demo:evidence:dry-run`.
- [ ] Registrar operador.
- [ ] Registrar data/hora.
- [ ] Registrar HEAD.
- [ ] Registrar hashes.
- [ ] Registrar resultados.
- [ ] Sanitizar URL, UUIDs e project ref.
- [ ] Guardar detalhes sensiveis fora do Git.

## 19. Criterios de Aprovacao

- [ ] Preflight ok.
- [ ] Dry-run ok.
- [ ] Schema ok.
- [ ] Seed ok.
- [ ] Verification ok.
- [ ] Health ok.
- [ ] Painel ok.
- [ ] Offline ok.
- [ ] Homologacao live ok.
- [ ] Evidencias completas.

## 20. Criterios de Parada Imediata

- [ ] Projeto incorreto.
- [ ] Dado real detectado.
- [ ] Credencial impressa.
- [ ] UUID completo em arquivo versionado.
- [ ] `--execute` sem confirmacao literal.
- [ ] Live ativado por padrao.
- [ ] WhatsApp/e-mail ativados.
- [ ] SQL destrutivo inesperado.
- [ ] Falha de RLS.
- [ ] Mistura de tenants.
- [ ] Operador inseguro sobre o proximo passo.

## Decisao Operacional

Prosseguir somente quando todos os itens obrigatorios estiverem marcados e evidenciados.
