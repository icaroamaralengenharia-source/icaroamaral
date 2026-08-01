# Sessao Operacional Criacao Demo Municipal

Data: 2026-08-01

## Estado da Sessao

- Branch esperada: `main`
- HEAD esperado: `943d5c6`
- Pacote operacional final: publicado
- Demo real: ainda nao criada
- Credenciais: devem permanecer fora do Git

Este documento lista somente as acoes manuais restantes. Ele nao autoriza criacao automatica de projeto, usuario, banco, SQL ou deploy.

## FASE 1 — Criar Projeto Demo

1. Abrir o provedor autorizado no navegador do operador.
2. Criar um projeto exclusivo de demonstracao.
3. Usar nome ficticio e sem dados reais.
4. Registrar o project ref em arquivo local seguro fora do Git.
5. Confirmar que o project ref nao e:
   - `mplpzyalcxhhinuvjthx`
   - `lidueokjpzxdybtongbk`
6. Confirmar que o projeto nao reutiliza E2E, producao, cliente ou homologacao antiga.
7. Parar se houver duvida sobre o projeto aberto.

## FASE 2 — Registrar Dados Nao Sensiveis

Registrar no formulario do operador:

1. Nome interno com prefixo `DEMO_MUNICIPAL_`.
2. Dominio HTTPS da demo.
3. Responsavel tecnico.
4. Project ref demo.
5. Confirmacao de isolamento.
6. Confirmacao de backup.
7. Confirmacao de WhatsApp/e-mail desligados.

Nao registrar senha, token, chave administrativa, string de conexao, credencial de sessao, chave de IA, e-mail pessoal, telefone ou CPF.

## FASE 3 — Criar Usuarios Ficticios

Criar manualmente no projeto demo:

1. `platform_admin`
2. `municipal_admin`
3. `gestor`
4. `leitura`

Regras:

- usar somente usuarios ficticios;
- nao usar pessoas reais;
- registrar UUIDs completos apenas fora do Git;
- em documentos versionados, usar somente UUID abreviado.

## FASE 4 — Gerar Runbook Local

Executar o wizard local:

```bash
npm --prefix backend run demo:wizard
```

Durante o wizard:

- nao informar senha;
- nao informar token;
- nao informar chave administrativa;
- nao informar string de conexao;
- revisar os arquivos gerados;
- manter `artifacts/` fora do Git.

Arquivos esperados em execucao local:

- `artifacts/municipal-demo-runbook.json`
- `artifacts/municipal-demo-operator-checklist.md`

## FASE 5 — Configuracao Local

1. Criar arquivo `.env` local fora do Git.
2. Preencher variaveis manualmente.
3. Manter integracoes externas desligadas:
   - `MUNICIPAL_WHATSAPP_ENABLED=false`
   - `MUNICIPAL_EMAIL_ENABLED=false`
4. Configurar CORS fechado para o dominio HTTPS da demo.
5. Exigir HTTPS.
6. Manter `RUN_DEMO_LIVE_TESTS=false` ate a homologacao autorizada.

## FASE 6 — Preflight Real

Executar somente apos preencher o ambiente local seguro:

```bash
npm --prefix backend run demo:preflight
```

Resultado esperado:

- `PASS`: seguir para a etapa manual seguinte;
- `BLOCKED`: parar imediatamente.

Se houver `BLOCKED`, nao tentar outro banco automaticamente e nao trocar o project ref sem nova revisao.

## FASE 7 — Aplicacao Manual

Executar em ordem:

1. Aplicar schema manualmente.
2. Criar usuarios ficticios, se ainda nao criados.
3. Substituir placeholders do seed por UUIDs ficticios reais do projeto demo.
4. Aplicar seed manualmente.
5. Executar verification.
6. Salvar evidencias sanitizadas.

Confirmacoes literais das escritas:

- `APLICAR_SCHEMA_DEMO`
- `APLICAR_SEED_DEMO`
- `REMOVER_DADOS_DEMO_MUNICIPAL`, somente em rollback/cleanup autorizado

Nao repetir aplicacao falha sem analise.

## FASE 8 — Homologacao

Validar por blocos:

1. Health.
2. Painel.
3. RLS.
4. Estoque.
5. Patrimonio.
6. Notificacoes.
7. Acervo.
8. Sentinela.
9. ELO.
10. Offline.
11. Desktop.
12. Tablet.
13. Celular.
14. Concorrencia por blocos.

Registrar evidencias de cada bloco. Parar ao primeiro vazamento de tenant, erro de RLS, credencial exposta, escrita inesperada ou divergencia de projeto.

## Primeira Acao do Operador

Abrir o provedor autorizado e criar manualmente um projeto exclusivo de demonstracao com nome ficticio, antes de preencher qualquer credencial local.